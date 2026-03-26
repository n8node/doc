import { prisma } from "@/lib/prisma";
import { isN8nDbEnabled, type N8nDbTarget } from "@/lib/n8n-db/client";
import {
  pullSheetFromN8n,
  pushSheetToN8n,
  type SheetForSync,
} from "@/lib/n8n-db/sheet-sync";

export async function loadSheetForN8nSync(
  sheetId: string,
  userId: string
): Promise<SheetForSync | null> {
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  if (!sheet) return null;
  const cells = await prisma.sheetCell.findMany({
    where: { sheetId },
    select: { columnId: true, rowIndex: true, value: true },
  });
  const byRow = new Map<number, Record<string, string | null>>();
  for (const c of cells) {
    const row = byRow.get(c.rowIndex) ?? {};
    row[c.columnId] = c.value;
    byRow.set(c.rowIndex, row);
  }
  const rowIndexes = Array.from(byRow.keys()).sort((a, b) => a - b);
  const rows = rowIndexes.map((rowIndex) => ({
    rowIndex,
    cells: byRow.get(rowIndex) ?? {},
  }));
  return {
    id: sheet.id,
    columns: sheet.columns.map((c) => ({ id: c.id, order: c.order, name: c.name })),
    rows,
  };
}

/**
 * Полная синхронизация одного подключения: pull из n8n-db в Prisma, затем push из Prisma в n8n-db.
 */
export async function syncOneN8nConnection(
  sheetId: string,
  userId: string,
  conn: { tableName: string; target: string | null },
  options?: { skipIfN8nDisabled?: boolean }
): Promise<void> {
  const target = ((conn.target as N8nDbTarget) || "DEFAULT") as N8nDbTarget;
  if (!isN8nDbEnabled(target)) {
    if (options?.skipIfN8nDisabled) return;
    throw new Error("Подключение n8n не настроено на сервере");
  }
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  if (!sheet) {
    throw new Error("Not found");
  }
  const columnIds = sheet.columns.map((c) => c.id);
  const pulled = await pullSheetFromN8n(conn.tableName, columnIds, target);
  for (const row of pulled) {
    for (const colId of columnIds) {
      const value = row.cells[colId] ?? null;
      await prisma.sheetCell.upsert({
        where: {
          sheetId_columnId_rowIndex: { sheetId, columnId: colId, rowIndex: row.rowIndex },
        },
        create: { sheetId, columnId: colId, rowIndex: row.rowIndex, value },
        update: { value },
      });
    }
  }
  const sheetData = await loadSheetForN8nSync(sheetId, userId);
  if (sheetData) {
    await pushSheetToN8n(sheetData, conn.tableName, target);
  }
}

/**
 * Только push текущего состояния листа во все таблицы n8n-db для этого листа.
 */
export async function pushSheetToAllN8nConnections(
  sheetId: string,
  userId: string
): Promise<void> {
  const connections = await prisma.n8nTableConnection.findMany({
    where: { sheetId, userId },
  });
  if (connections.length === 0) return;
  const sheetData = await loadSheetForN8nSync(sheetId, userId);
  if (!sheetData) return;
  for (const conn of connections) {
    const target = ((conn.target as N8nDbTarget) || "DEFAULT") as N8nDbTarget;
    if (!isN8nDbEnabled(target)) continue;
    try {
      await pushSheetToN8n(sheetData, conn.tableName, target);
    } catch (err) {
      console.error("[pushSheetToAllN8nConnections]", conn.id, err);
    }
  }
}

export async function syncAllN8nConnectionsForSheet(
  sheetId: string,
  userId: string
): Promise<{ synced: number; skipped: number; failed: number }> {
  const conns = await prisma.n8nTableConnection.findMany({
    where: { sheetId, userId },
  });
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  for (const conn of conns) {
    const target = ((conn.target as N8nDbTarget) || "DEFAULT") as N8nDbTarget;
    if (!isN8nDbEnabled(target)) {
      skipped += 1;
      continue;
    }
    try {
      await syncOneN8nConnection(sheetId, userId, conn, { skipIfN8nDisabled: true });
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error("[syncAllN8nConnectionsForSheet]", conn.id, err);
    }
  }
  return { synced, skipped, failed };
}
