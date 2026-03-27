import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan-service";
import { calculateFreePlanTimer } from "@/lib/plan-service";

const PREFIX = "mail_";
const SEP = "__";

function parseMailKey(token: string): { keyToken: string; fullKey: string } | null {
  if (!token.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const idx = rest.indexOf(SEP);
  if (idx < 0) return null;
  const keyToken = rest.slice(0, idx);
  if (!keyToken) return null;
  return { keyToken, fullKey: token };
}

async function checkFreePlanExpiry(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      createdAt: true,
      plan: { select: { isFree: true, freePlanDurationDays: true } },
    },
  });
  if (!user) return null;
  if (user.role === "ADMIN") return userId;

  const durationDays = user.plan?.freePlanDurationDays;
  if (user.plan?.isFree !== true || durationDays == null) return userId;

  const timer = calculateFreePlanTimer({
    startedAt: user.createdAt,
    durationDays,
  });
  return timer.isExpired ? null : userId;
}

/**
 * Пользователь для API интеграций почты: сессия или Bearer mail_...
 * Требуется plan feature mail_bridge.
 */
export async function getMailBridgeUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const parsed = parseMailKey(token);
    if (!parsed) return null;

    const row = await prisma.mailBridgeApiKey.findUnique({
      where: { keyToken: parsed.keyToken },
      select: { id: true, keyHash: true, userId: true },
    });
    if (!row) return null;

    const valid = await compare(parsed.fullKey, row.keyHash);
    if (!valid) return null;

    const allowed = await hasFeature(row.userId, "mail_bridge");
    if (!allowed) return null;

    await prisma.mailBridgeApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return checkFreePlanExpiry(row.userId);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const allowed = await hasFeature(session.user.id, "mail_bridge");
  if (!allowed) return null;

  return checkFreePlanExpiry(session.user.id);
}

const SECRET_LENGTH = 32;

export async function createMailBridgeApiKey(
  userId: string,
  name: string
): Promise<{ id: string; name: string; key: string; keyPrefix: string }> {
  const keyToken = nanoid(16);
  const secret = randomBytes(SECRET_LENGTH / 2).toString("hex");
  const fullKey = `${PREFIX}${keyToken}${SEP}${secret}`;
  const keyHash = await hash(fullKey, 12);
  const keyPrefix = `${PREFIX}${keyToken.slice(0, 8)}...`;

  const row = await prisma.mailBridgeApiKey.create({
    data: {
      userId,
      name: name.trim().slice(0, 100) || "n8n",
      keyToken,
      keyHash,
      keyPrefix,
    },
  });

  return {
    id: row.id,
    name: row.name,
    key: fullKey,
    keyPrefix: row.keyPrefix,
  };
}
