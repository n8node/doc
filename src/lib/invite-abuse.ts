import { prisma } from "@/lib/prisma";
import {
  formatSpamRegistrationMessage,
  getTelegramConfig,
  sendTelegramMessage,
} from "@/lib/telegram";

const SPAM_WINDOW_MINUTES = 15;
const ALERT_COOLDOWN_MINUTES = 120;

type SpamSeverity = "WARNING" | "CRITICAL";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractDomain(email: string): string {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at === -1 || at === value.length - 1) return "";
  return value.slice(at + 1);
}

function formatWindowDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeCooldownKey(rootUserId: string, severity: SpamSeverity): string {
  const bucketMs = ALERT_COOLDOWN_MINUTES * 60 * 1000;
  const bucketStart = Math.floor(Date.now() / bucketMs) * bucketMs;
  return `${rootUserId}:${severity}:${bucketStart}`;
}

export async function getInviteChainUserIds(
  rootUserId: string,
  options?: { maxDepth?: number }
): Promise<string[]> {
  const maxDepth = Math.max(1, options?.maxDepth ?? 6);
  const visited = new Set<string>([rootUserId]);
  let frontier: string[] = [rootUserId];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (frontier.length === 0) break;
    const children = await prisma.user.findMany({
      where: {
        registeredViaInvite: {
          ownerUserId: { in: frontier },
        },
      },
      select: { id: true },
    });

    const nextFrontier: string[] = [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      nextFrontier.push(child.id);
    }
    frontier = nextFrontier;
  }

  return Array.from(visited);
}

export async function banInviteChainByRootUser(params: {
  rootUserId: string;
}) {
  const userIds = await getInviteChainUserIds(params.rootUserId, { maxDepth: 8 });
  if (userIds.length === 0) {
    return { usersBlocked: 0, invitesRevoked: 0, affectedUserIds: [] as string[] };
  }

  const now = new Date();
  const [usersResult, invitesResult] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: userIds }, isBlocked: false },
      data: {
        isBlocked: true,
        blockedAt: now,
      },
    }),
    prisma.invite.updateMany({
      where: {
        ownerUserId: { in: userIds },
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
      },
    }),
  ]);

  return {
    usersBlocked: usersResult.count,
    invitesRevoked: invitesResult.count,
    affectedUserIds: userIds,
  };
}

export async function evaluateRegistrationSpamAndNotify(params: {
  rootUserId: string | null;
}) {
  if (!params.rootUserId) return null;

  const rootUser = await prisma.user.findUnique({
    where: { id: params.rootUserId },
    select: { id: true, email: true, name: true },
  });
  if (!rootUser) return null;

  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - SPAM_WINDOW_MINUTES * 60 * 1000
  );

  const registrations = await prisma.user.findMany({
    where: {
      createdAt: { gte: windowStart, lte: windowEnd },
      registeredViaInvite: {
        ownerUserId: rootUser.id,
      },
    },
    select: {
      id: true,
      email: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const registrationsCount = registrations.length;
  if (registrationsCount < 3) return null;

  const verifiedCount = registrations.filter((u) => u.isEmailVerified).length;
  const activeCount = registrations.filter((u) => u.lastLoginAt != null).length;
  const verificationRate = registrationsCount > 0 ? verifiedCount / registrationsCount : 0;
  const activityRate = registrationsCount > 0 ? activeCount / registrationsCount : 0;
  const domains = unique(registrations.map((u) => extractDomain(u.email)).filter(Boolean));
  const uniqueDomains = domains.length;

  let score = 0;
  const reasons: string[] = [];

  if (registrationsCount >= 5) {
    score += 40;
    reasons.push(`быстрый всплеск (${registrationsCount} рег. за ${SPAM_WINDOW_MINUTES} мин)`);
  }
  if (verificationRate < 0.2) {
    score += 30;
    reasons.push(`низкая верификация email (${Math.round(verificationRate * 100)}%)`);
  }
  if (activityRate < 0.15) {
    score += 20;
    reasons.push(`низкая активность (${Math.round(activityRate * 100)}%)`);
  }
  if (registrationsCount >= 5 && uniqueDomains <= 2) {
    score += 20;
    reasons.push(`мало уникальных доменов (${uniqueDomains})`);
  }

  const firstTs = registrations[0]?.createdAt.getTime();
  const lastTs = registrations[registrations.length - 1]?.createdAt.getTime();
  const spreadMinutes = firstTs != null && lastTs != null ? (lastTs - firstTs) / 60000 : 0;
  if (registrationsCount >= 5 && spreadMinutes <= 10) {
    score += 20;
    reasons.push(`плотная серия регистраций (${Math.max(1, Math.round(spreadMinutes))} мин)`);
  }

  const previousDayAlerts = await prisma.spamAlertEvent.count({
    where: {
      rootUserId: rootUser.id,
      createdAt: { gte: new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000) },
    },
  });
  if (previousDayAlerts >= 1) {
    score += 30;
    reasons.push("повторный инцидент за 24 часа");
  }

  if (score < 60) return null;
  const severity: SpamSeverity = score >= 90 ? "CRITICAL" : "WARNING";
  const cooldownKey = computeCooldownKey(rootUser.id, severity);

  const existing = await prisma.spamAlertEvent.findUnique({
    where: { cooldownKey },
    select: { id: true },
  });
  if (existing) return { skipped: true, reason: "cooldown" } as const;

  const cfg = await getTelegramConfig();
  let sentToTelegram = false;
  if (
    cfg.notifySpamRegistrationEnabled &&
    cfg.botToken &&
    cfg.chatId
  ) {
    const message = formatSpamRegistrationMessage(cfg.spamRegistrationMessage, {
      rootUserEmail: rootUser.email,
      severity,
      score,
      registrationsCount,
      verificationRate: Math.round(verificationRate * 100),
      activityRate: Math.round(activityRate * 100),
      uniqueDomains,
      reasons,
      windowStart: formatWindowDate(windowStart),
      windowEnd: formatWindowDate(windowEnd),
    });
    sentToTelegram = await sendTelegramMessage(cfg.botToken, cfg.chatId, message);
  }

  const created = await prisma.spamAlertEvent.create({
    data: {
      rootUserId: rootUser.id,
      severity,
      score,
      registrationsCount,
      verificationRate,
      activityRate,
      uniqueDomains,
      windowStart,
      windowEnd,
      cooldownKey,
      sentToTelegram,
      details: {
        domains,
        reasons,
      },
    },
    select: {
      id: true,
      severity: true,
      score: true,
      registrationsCount: true,
      sentToTelegram: true,
    },
  });

  return created;
}
