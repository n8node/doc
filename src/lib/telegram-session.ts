import { createHmac } from "crypto";

const TTL_SEC = 120;

export function createTelegramSessionToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "fallback-change-me";
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${userId}:${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyTelegramSessionToken(token: string): string | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET || "fallback-change-me";
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, tsStr, sig] = decoded.split(":");
    if (!userId || !tsStr || !sig) return null;

    const ts = parseInt(tsStr, 10);
    if (isNaN(ts) || Date.now() / 1000 - ts > TTL_SEC) return null;

    const payload = `${userId}:${tsStr}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expected) return null;

    return userId;
  } catch {
    return null;
  }
}
