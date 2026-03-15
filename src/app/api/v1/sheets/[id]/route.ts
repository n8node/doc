import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbTarget } from "@/lib/n8n-db/client";
import { revokeN8nTableConnection } from "@/lib/n8n-db/sheet-sync";

type Ctx = { params: Promise<{ id: string }> };

async function getSheetForUser(sheetId: string, userId: string) {
  return prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
}

/**
 * GET /api/v1/sheets/:id — одна таблица с колонками и данными ячеек
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cells = await prisma.sheetCell.findMany({
    where: { sheetId: id },
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

  return NextResponse.json({
    id: sheet.id,
    name: sheet.name,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
    columns: sheet.columns.map((c) => ({
      id: c.id,
      order: c.order,
      name: c.name,
      dataType: c.dataType,
      config: c.config,
    })),
    rows,
  });
}

/**
 * PATCH /api/v1/sheets/:id — переименовать таблицу
 * Body: { name: string }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const updated = await prisma.sheet.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/**
 * DELETE /api/v1/sheets/:id
 * Удаляет таблицу и отзывает все n8n-подключения (роль и таблица в n8n-db).
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const connections = await prisma.n8nTableConnection.findMany({
    where: { sheetId: id },
    select: { dbRoleName: true, tableName: true, target: true },
  });

  for (const conn of connections) {
    const target = isN8nDbTarget(conn.target) ? conn.target : "DEFAULT";
    try {
      await revokeN8nTableConnection(conn.dbRoleName, conn.tableName, target);
    } catch (err) {
      console.error("[sheets DELETE] revoke n8n connection:", conn.dbRoleName, err);
    }
  }

  await prisma.sheet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
