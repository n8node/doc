import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { prisma } from "./prisma";

const CACHE = new Map<string, string>();
const ALG = "aes-256-cbc";
const IV_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const envKey = process.env.CONFIG_ENCRYPTION_KEY;
  if (!envKey || envKey.length < 32) {
    throw new Error("CONFIG_ENCRYPTION_KEY must be at least 32 chars");
  }
  return scryptSync(envKey.slice(0, 32), "dropbox-ru-salt", KEY_LEN);
}

export class ConfigStore {
  async get(key: string): Promise<string | null> {
    const cached = CACHE.get(key);
    if (cached !== undefined) return cached;

    const row = await prisma.adminConfig.findUnique({ where: { key } });
    if (!row) {
      const envKey = `CONFIG_${key.toUpperCase().replace(/\./g, "_")}`;
      return process.env[envKey] ?? null;
    }

    try {
      const value = row.isEncrypted ? this.decrypt(row.value) : row.value;
      CACHE.set(key, value);
      return value;
    } catch (err) {
      // Неверный CONFIG_ENCRYPTION_KEY, битые данные или isEncrypted без шифрования — не роняем весь запрос
      console.error(`[config-store] get("${key}") failed:`, err);
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    opts?: { isEncrypted?: boolean; description?: string; category?: string }
  ): Promise<void> {
    const isEncrypted = opts?.isEncrypted ?? false;
    const finalValue = isEncrypted ? this.encrypt(value) : value;
    CACHE.delete(key);

    await prisma.adminConfig.upsert({
      where: { key },
      create: {
        key,
        value: finalValue,
        isEncrypted,
        description: opts?.description ?? null,
        category: opts?.category ?? "general",
      },
      update: {
        value: finalValue,
        isEncrypted,
        description: opts?.description ?? undefined,
        category: opts?.category ?? undefined,
      },
    });
  }

  private encrypt(text: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, key, iv);
    const enc = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    return iv.toString("hex") + ":" + enc.toString("hex");
  }

  private decrypt(encrypted: string): string {
    const [ivHex, dataHex] = encrypted.split(":");
    if (!ivHex || !dataHex) throw new Error("Invalid encrypted format");
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(ALG, key, iv);
    return decipher.update(dataHex, "hex", "utf8") + decipher.final("utf8");
  }

  invalidate(key: string): void {
    CACHE.delete(key);
  }
}

export const configStore = new ConfigStore();
