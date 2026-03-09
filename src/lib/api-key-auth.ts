import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { calculateFreePlanTimer } from "@/lib/plan-service";

const KEY_PREFIX = "qk_";
const SECRET_LENGTH = 32;

/**
 * Parse API key and extract keyToken for lookup.
 * Format: qk_<keyToken>__<secret>
 */
function parseApiKey(token: string): { keyToken: string; fullKey: string } | null {
  if (!token.startsWith(KEY_PREFIX)) return null;
  const rest = token.slice(KEY_PREFIX.length);
  const sep = "__";
  const idx = rest.indexOf(sep);
  if (idx < 0) return null;
  const keyToken = rest.slice(0, idx);
  const fullKey = token;
  if (!keyToken) return null;
  return { keyToken, fullKey };
}

/**
 * Resolve user from request: session (cookie) or API key (Bearer).
 * Returns userId or null.
 */
export async function getUserIdFromRequest(
  request: NextRequest,
  options?: { allowExpiredFreePlan?: boolean }
): Promise<string | null> {
  const allowExpiredFreePlan = options?.allowExpiredFreePlan === true;

  const checkFreePlanExpiry = async (userId: string) => {
    if (allowExpiredFreePlan) return userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        createdAt: true,
        plan: {
          select: {
            isFree: true,
            freePlanDurationDays: true,
          },
        },
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
  };

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const parsed = parseApiKey(token);
    if (!parsed) return null;

    const row = await prisma.userApiKey.findUnique({
      where: { keyToken: parsed.keyToken },
      select: { id: true, keyHash: true, userId: true },
    });
    if (!row) return null;

    const valid = await compare(parsed.fullKey, row.keyHash);
    if (!valid) return null;

    await prisma.userApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return checkFreePlanExpiry(row.userId);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return checkFreePlanExpiry(session.user.id);
}

/**
 * Generate a new API key.
 * Returns the full key (shown once) - save it, it won't be shown again.
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<{ id: string; name: string; key: string; keyPrefix: string }> {
  const { hash } = await import("bcryptjs");
  const keyToken = nanoid(16);
  const secret = randomBytes(SECRET_LENGTH / 2).toString("hex");
  const fullKey = `${KEY_PREFIX}${keyToken}__${secret}`;
  const keyHash = await hash(fullKey, 12);
  const keyPrefix = `${KEY_PREFIX}${keyToken.slice(0, 8)}...`;

  const row = await prisma.userApiKey.create({
    data: {
      userId,
      name: name.trim().slice(0, 100) || "API Key",
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
