import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

const LLM_KEY_PREFIX = "QoQon_LLM_";
const SECRET_LENGTH = 32;

/**
 * Parse LLM API key. Format: QoQon_LLM_<keyToken>__<secret>
 */
export function parseLlmApiKey(
  token: string
): { keyToken: string; fullKey: string } | null {
  if (!token.startsWith(LLM_KEY_PREFIX)) return null;
  const rest = token.slice(LLM_KEY_PREFIX.length);
  const sep = "__";
  const idx = rest.indexOf(sep);
  if (idx < 0) return null;
  const keyToken = rest.slice(0, idx);
  const fullKey = token;
  if (!keyToken) return null;
  return { keyToken, fullKey };
}

export function isLlmApiKey(token: string): boolean {
  return token.trim().startsWith(LLM_KEY_PREFIX);
}

/**
 * Resolve userId from LLM API key (Bearer header).
 */
export async function getUserIdFromLlmKey(token: string): Promise<string | null> {
  const parsed = parseLlmApiKey(token.trim());
  if (!parsed) return null;

  const row = await prisma.userLlmApiKey.findUnique({
    where: { keyToken: parsed.keyToken },
    select: { id: true, keyHash: true, userId: true },
  });
  if (!row) return null;

  const valid = await compare(parsed.fullKey, row.keyHash);
  if (!valid) return null;

  await prisma.userLlmApiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return row.userId;
}

/**
 * Create new LLM API key with prefix QoQon_LLM_
 */
export async function createLlmApiKey(
  userId: string,
  name: string
): Promise<{ id: string; name: string; key: string; keyPrefix: string }> {
  const keyToken = nanoid(16);
  const secret = randomBytes(SECRET_LENGTH / 2).toString("hex");
  const fullKey = `${LLM_KEY_PREFIX}${keyToken}__${secret}`;
  const keyHash = await hash(fullKey, 12);
  const keyPrefix = `${LLM_KEY_PREFIX}${keyToken.slice(0, 8)}...`;

  const row = await prisma.userLlmApiKey.create({
    data: {
      userId,
      name: name.trim().slice(0, 100) || "LLM Key",
      keyToken,
      keyHash,
      keyPrefix,
    },
  });

  return {
    id: row.id,
    name: row.name,
    key: fullKey,
    keyPrefix,
  };
}
