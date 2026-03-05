import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

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
  request: NextRequest
): Promise<string | null> {
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

    return row.userId;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
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
