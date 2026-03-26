import { randomBytes } from "crypto";

const TTL_MS = 2 * 60 * 60 * 1000;

type Entry = { fileId: string; userId: string; exp: number };

/** In-memory: один процесс Node (Docker app). При нескольких репликах — позже Redis. */
const store = new Map<string, Entry>();

function sweepExpired(): void {
  const now = Date.now();
  for (const k of Array.from(store.keys())) {
    const v = store.get(k);
    if (v && v.exp < now) store.delete(k);
  }
}

/**
 * Короткий тикет вместо JWT в query — иначе URL слишком длинный и nginx обрезает (скелет ONLYOFFICE).
 */
export function createDownloadTicket(input: { fileId: string; userId: string }): string {
  sweepExpired();
  const t = randomBytes(24).toString("hex");
  store.set(t, {
    fileId: input.fileId,
    userId: input.userId,
    exp: Date.now() + TTL_MS,
  });
  return t;
}

export function verifyDownloadTicket(t: string): {
  fileId: string;
  userId: string;
} | null {
  if (!/^[a-f0-9]{48}$/.test(t)) return null;
  sweepExpired();
  const v = store.get(t);
  if (!v || v.exp < Date.now()) return null;
  return { fileId: v.fileId, userId: v.userId };
}
