import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

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

export function encryptApiKey(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  if (!ivHex || !dataHex) throw new Error("Invalid encrypted format");
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALG, key, iv);
  return decipher.update(dataHex, "hex", "utf8") + decipher.final("utf8");
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}
