import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export interface RecordHistoryEventInput {
  userId: string;
  action: string;
  summary: string;
  payload?: Record<string, unknown> | null;
  batchId?: string | null;
}

export interface HistoryEventRow {
  id: string;
  action: string;
  summary: string;
  payload: Record<string, unknown> | null;
  batchId: string | null;
  createdAt: string;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureHistoryTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "history_events" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "action" TEXT NOT NULL,
          "summary" TEXT NOT NULL,
          "payload" JSONB,
          "batch_id" TEXT,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "history_events_user_created_idx"
        ON "history_events" ("user_id", "created_at" DESC)
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "history_events_batch_idx"
        ON "history_events" ("batch_id")
      `);
    })();
  }

  return ensureTablePromise;
}

export async function recordHistoryEvent(input: RecordHistoryEventInput) {
  await ensureHistoryTable();

  const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "history_events" (
        "id",
        "user_id",
        "action",
        "summary",
        "payload",
        "batch_id"
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    randomUUID(),
    input.userId,
    input.action,
    input.summary,
    payloadJson,
    input.batchId ?? null
  );
}

export async function listHistoryEvents(userId: string, limit = 200): Promise<HistoryEventRow[]> {
  await ensureHistoryTable();

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      action: string;
      summary: string;
      payload: unknown;
      batch_id: string | null;
      created_at: Date;
    }>
  >(
    `
      SELECT
        "id",
        "action",
        "summary",
        "payload",
        "batch_id",
        "created_at"
      FROM "history_events"
      WHERE "user_id" = $1
      ORDER BY "created_at" DESC
      LIMIT $2
    `,
    userId,
    limit
  );

  return rows.map((row) => {
    let payload: Record<string, unknown> | null = null;
    if (row.payload && typeof row.payload === "object") {
      payload = row.payload as Record<string, unknown>;
    } else if (typeof row.payload === "string") {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    }

    return {
      id: row.id,
      action: row.action,
      summary: row.summary,
      payload,
      batchId: row.batch_id,
      createdAt: row.created_at.toISOString(),
    };
  });
}
