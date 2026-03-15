import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getN8nDbTargetsStatus,
  getN8nDbConnectionParams,
  isN8nDbEnabled,
  isN8nDbTarget,
  type N8nDbTarget,
} from "@/lib/n8n-db/client";
import {
  createN8nTableConnection,
  hashN8nTablePassword,
  type SheetForSync,
} from "@/lib/n8n-db/sheet-sync";

type Ctx = { params: Promise<{ id: string }> };

async function getSheetForUser(sheetId: string, userId: string) {
  return prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
}

async function getSheetForSync(sheetId: string, userId: string): Promise<SheetForSync | null> {
  const sheet = await getSheetForUser(sheetId, userId);
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

export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sheetId } = await ctx.params;
  const sheet = await getSheetForUser(sheetId, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const connections = await prisma.n8nTableConnection.findMany({
    where: { sheetId, userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    connections: connections.map((c) => ({
      id: c.id,
      dbRoleName: c.dbRoleName,
      tableName: c.tableName,
      target: c.target as N8nDbTarget,
      createdAt: c.createdAt.toISOString(),
    })),
    targets: getN8nDbTargetsStatus(),
    n8nDbEnabled: isN8nDbEnabled("DEFAULT"),
    connectionParams: getN8nDbConnectionParams("DEFAULT"),
  });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const targetValue = typeof body?.target === "string" ? body.target : "DEFAULT";
  const target: N8nDbTarget = isN8nDbTarget(targetValue) ? targetValue : "DEFAULT";
  if (!isN8nDbEnabled(target)) {
    return NextResponse.json(
      {
        error:
          target === "RF"
            ? "Подключение n8n (РФ сервер) не настроено на сервере"
            : "Подключение n8n не настроено на сервере",
      },
      { status: 503 }
    );
  }
  const { id: sheetId } = await ctx.params;
  const sheetData = await getSheetForSync(sheetId, session.user.id);
  if (!sheetData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sheetData.columns.length === 0) {
    return NextResponse.json(
      { error: "Добавьте хотя бы одну колонку в таблицу" },
      { status: 400 }
    );
  }
  try {
    const result = await createN8nTableConnection(sheetData, target);
    const passwordHash = await hashN8nTablePassword(result.dbPassword);
    await prisma.n8nTableConnection.create({
      data: {
        userId: session.user.id,
        sheetId,
        dbRoleName: result.dbRoleName,
        dbPasswordHash: passwordHash,
        tableName: result.tableName,
        target,
      },
    });
    const params = getN8nDbConnectionParams(target);
    return NextResponse.json({
      dbRoleName: result.dbRoleName,
      dbPassword: result.dbPassword,
      tableName: result.tableName,
      target,
      host: params?.host ?? "",
      port: params?.port ?? 5432,
      database: params?.database ?? "",
      ssl: params?.ssl ?? true,
    });
  } catch (err) {
    console.error("[sheets n8n-connections] Create error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка создания подключения" },
      { status: 500 }
    );
  }
}
