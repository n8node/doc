import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  category: "info" | "warning" | "success" | "error";
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}

const NOTIFICATION_TYPE_KEYS: Record<string, string> = {
  STORAGE: "storage",
  TRASH: "trash",
  PAYMENT: "payment",
  AI_TASK: "aiTask",
  QUOTA: "quota",
  SHARE_LINK: "shareLink",
  SUPPORT_TICKET: "supportTicket",
};

async function isNotificationTypeEnabled(
  userId: string,
  type: string
): Promise<boolean> {
  const key = NOTIFICATION_TYPE_KEYS[type];
  if (!key) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = user?.preferences as Record<string, unknown> | null;
  const notifications = prefs?.notifications as Record<string, boolean> | undefined;
  const val = notifications && typeof notifications[key] === "boolean"
    ? notifications[key]
    : undefined;
  return val !== false;
}

export async function createNotificationIfEnabled(
  input: CreateNotificationInput
): Promise<void> {
  const enabled = await isNotificationTypeEnabled(input.userId, input.type);
  if (!enabled) return;
  await createNotification(input);
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
    },
  });
}

export interface ListNotificationsInput {
  userId: string;
  limit?: number;
  offset?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
}

export async function listNotifications(input: ListNotificationsInput) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);

  const where = {
    userId: input.userId,
    ...(input.type && { type: input.type }),
    ...(input.unreadOnly && { readAt: null }),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, readAt: null },
  });

  return { items, total, unreadCount };
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function deleteAllNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: { userId },
  });
}

/** Avoid duplicate warning notifications within 24h for same type+key */
async function hasRecentNotification(
  userId: string,
  type: string,
  payloadKey: string,
  payloadVal: number | string,
  withinHours = 24
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3600 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: type as "QUOTA" | "STORAGE" | "SHARE_LINK",
      createdAt: { gte: since },
      payload: { path: [payloadKey], equals: payloadVal } as object,
    },
  });
  return !!existing;
}

export async function createQuota80WarningIfNeeded(
  userId: string,
  used: number,
  quota: number,
  kind: "embedding" | "transcription"
): Promise<void> {
  if (quota <= 0 || used < Math.ceil(quota * 0.8) || used >= quota) return;
  const hasRecent = await hasRecentNotification(userId, "QUOTA", "warningPercent", 80);
  if (hasRecent) return;
  await createNotificationIfEnabled({
    userId,
    type: "QUOTA",
    category: "warning",
    title: kind === "embedding" ? "Лимит анализа почти исчерпан" : "Лимит транскрибации почти исчерпан",
    body: `Использовано ~${Math.round((used / quota) * 100)}% лимита. Обновите тариф при необходимости.`,
    payload: { used, quota, warningPercent: 80 },
  });
}

export async function createStorage90WarningIfNeeded(
  userId: string,
  used: bigint,
  quota: bigint
): Promise<void> {
  if (quota <= BigInt(0)) return;
  const ratio = Number(used) / Number(quota);
  if (ratio < 0.9) return;
  const hasRecent = await hasRecentNotification(userId, "STORAGE", "warningPercent", 90);
  if (hasRecent) return;
  await createNotificationIfEnabled({
    userId,
    type: "STORAGE",
    category: "warning",
    title: "Хранилище почти заполнено",
    body: `Использовано ~${Math.round(ratio * 100)}% объёма. Освободите место или смените тариф.`,
    payload: { used: used.toString(), quota: quota.toString(), warningPercent: 90 },
  });
}

export async function createShareLinkExpiryNotifications(
  userId: string,
  links: Array<{ id: string; expiresAt: Date | null; file?: { name: string } | null; folder?: { name: string } | null }>
): Promise<void> {
  const now = Date.now();
  const day = 86400 * 1000;
  for (const link of links) {
    if (!link.expiresAt) continue;
    const expMs = link.expiresAt.getTime();
    const daysLeft = Math.ceil((expMs - now) / day);
    const targetName = link.file?.name ?? link.folder?.name ?? "файл";
    const hasRecent = await hasRecentNotification(userId, "SHARE_LINK", "linkId", link.id, 24);
    if (hasRecent) continue;
    if (daysLeft <= 0) {
      await createNotificationIfEnabled({
        userId,
        type: "SHARE_LINK",
        category: "warning",
        title: "Ссылка истекла",
        body: `Публичная ссылка на "${targetName}" больше недействительна.`,
        payload: { linkId: link.id, expired: true },
      });
    } else if (daysLeft <= 3) {
      await createNotificationIfEnabled({
        userId,
        type: "SHARE_LINK",
        category: "warning",
        title: "Ссылка скоро истекает",
        body: `Ссылка на "${targetName}" истекает через ${daysLeft} дн.`,
        payload: { linkId: link.id, daysLeft },
      });
    }
  }
}
