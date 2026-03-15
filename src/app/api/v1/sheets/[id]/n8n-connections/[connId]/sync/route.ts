import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbEnabled, type N8nDbTarget } from "@/lib/n8n-db/client";
import {
  pushSheetToN8n,
  pullSheetFromN8n,
  type SheetForSync,
} from "@/lib/n8n-db/sheet-sync";

type Ctx = { params: Promise<{ id: string; connId: string }> };

async function getSheetForSync(sheetId: string, userId: string): Promise<SheetForSync | null> {
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
 * POST /api/v1/sheets/:id/n8n-connections/:connId/sync
 * Two-way: pull from n8n-db into app, then push app state to n8n-db.
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sheetId, connId } = await ctx.params;
  const conn = await prisma.n8nTableConnection.findFirst({
    where: { id: connId, sheetId, userId: session.user.id },
  });
  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  const target = (conn.target as N8nDbTarget) || "DEFAULT";
  if (!isN8nDbEnabled(target)) {
    return NextResponse.json(
      { error: "Подключение n8n не настроено на сервере" },
      { status: 503 }
    );
  }
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId: session.user.id },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const columnIds = sheet.columns.map((c) => c.id);
  try {
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
    const sheetData = await getSheetForSync(sheetId, session.user.id);
    if (sheetData) {
      await pushSheetToN8n(sheetData, conn.tableName, target);
    }
    return NextResponse.json({ ok: true, pulledRows: pulled.length });
  } catch (err) {
    console.error("[sheets n8n-connections] Sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка синхронизации" },
      { status: 500 }
    );
  }
}
