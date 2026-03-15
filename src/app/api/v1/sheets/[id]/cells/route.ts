import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

type ColumnMeta = { id: string; dataType: string; config: unknown };

function validateCellValue(
  value: string | null,
  dataType: string,
  config: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = value == null ? "" : String(value).trim();
  if (s === "") return { ok: true, value: null };

  switch (dataType) {
    case "text":
      return { ok: true, value: value };
    case "number": {
      const n = parseFloat(s);
      if (Number.isNaN(n)) return { ok: false, error: "Ожидается число" };
      return { ok: true, value: String(n) };
    }
    case "boolean": {
      const lower = s.toLowerCase();
      if (["true", "false", "1", "0", "да", "нет", "yes", "no"].includes(lower)) {
        const normalized = ["true", "1", "да", "yes"].includes(lower) ? "true" : "false";
        return { ok: true, value: normalized };
      }
      return { ok: false, error: "Ожидается Да/Нет (true/false, 1/0)" };
    }
    case "date": {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
      if (dateOnly.test(s)) return { ok: true, value: s };
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        const iso = d.toISOString().slice(0, 10);
        return { ok: true, value: iso };
      }
      return { ok: false, error: "Ожидается дата (YYYY-MM-DD)" };
    }
    case "datetime": {
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        return { ok: true, value: d.toISOString() };
      }
      return { ok: false, error: "Ожидается дата и время" };
    }
    case "select": {
      const opts = config && typeof config === "object" && "options" in config && Array.isArray((config as { options?: unknown }).options)
        ? ((config as { options: string[] }).options)
        : null;
      if (opts && opts.length > 0) {
        const found = opts.includes(s) || opts.some((o) => String(o).toLowerCase() === s.toLowerCase());
        if (!found) return { ok: false, error: `Значение должно быть из списка: ${opts.slice(0, 5).join(", ")}${opts.length > 5 ? "…" : ""}` };
      }
      return { ok: true, value: s };
    }
    default:
      return { ok: true, value: value };
  }
}

async function getSheetForUser(sheetId: string, userId: string) {
  return prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
}

/**
 * GET /api/v1/sheets/:id/cells — данные ячеек (опционально range)
 * Query: startRow?, endRow?, columnIds? (comma-separated)
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const startRow = searchParams.get("startRow");
  const endRow = searchParams.get("endRow");
  const columnIdsParam = searchParams.get("columnIds");

  const where: { sheetId: string; columnId?: { in: string[] }; rowIndex?: { gte?: number; lte?: number } } = {
    sheetId: id,
  };
  if (columnIdsParam) {
    const ids = columnIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) where.columnId = { in: ids };
  }
  const start = startRow !== null && startRow !== "" ? parseInt(startRow, 10) : undefined;
  const end = endRow !== null && endRow !== "" ? parseInt(endRow, 10) : undefined;
  if (Number.isFinite(start) || Number.isFinite(end)) {
    where.rowIndex = {};
    if (Number.isFinite(start)) where.rowIndex.gte = start as number;
    if (Number.isFinite(end)) where.rowIndex.lte = end as number;
  }

  const cells = await prisma.sheetCell.findMany({
    where,
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

  return NextResponse.json({ rows });
}

/**
 * PATCH /api/v1/sheets/:id/cells — массовое обновление ячеек
 * Body: { updates: Array<{ rowIndex: number, columnId: string, value: string | null }> }
 * или { fill: { startRow, endRow, columnIds: string[], value: string | null } }
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

  let body: {
    updates?: Array<{ rowIndex: number; columnId: string; value: string | null }>;
    fill?: { startRow: number; endRow: number; columnIds: string[]; value: string | null };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const columnById = new Map<string, ColumnMeta>(
    sheet.columns.map((c) => [c.id, { id: c.id, dataType: c.dataType, config: c.config }])
  );
  const columnIds = new Set(sheet.columns.map((c) => c.id));
  const updates: Array<{ rowIndex: number; columnId: string; value: string | null }> = [];

  function validateAndPush(rowIndex: number, columnId: string, rawValue: string | null): void {
    const col = columnById.get(columnId);
    if (!col) return;
    const result = validateCellValue(rawValue, col.dataType, col.config);
    if (!result.ok) throw new Error(result.error);
    updates.push({ rowIndex, columnId, value: result.value });
  }

  try {
    if (Array.isArray(body.updates)) {
      for (const u of body.updates) {
        if (typeof u.rowIndex !== "number" || !columnIds.has(u.columnId)) continue;
        const raw = u.value == null ? null : String(u.value);
        validateAndPush(u.rowIndex, u.columnId, raw);
      }
    }

    if (body.fill && Array.isArray(body.fill.columnIds)) {
      const { startRow, endRow } = body.fill;
      const s = Number(startRow);
      const e = Number(endRow);
      if (!Number.isFinite(s) || !Number.isFinite(e)) {
        return NextResponse.json({ error: "fill.startRow and fill.endRow required" }, { status: 400 });
      }
      const val = body.fill.value == null ? null : String(body.fill.value);
      for (let r = s; r <= e; r++) {
        for (const colId of body.fill.columnIds) {
          if (columnIds.has(colId)) validateAndPush(r, colId, val);
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неверное значение ячейки";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  for (const u of updates) {
    await prisma.sheetCell.upsert({
      where: {
        sheetId_columnId_rowIndex: { sheetId: id, columnId: u.columnId, rowIndex: u.rowIndex },
      },
      create: {
        sheetId: id,
        columnId: u.columnId,
        rowIndex: u.rowIndex,
        value: u.value,
      },
      update: { value: u.value },
    });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}

/**
 * DELETE /api/v1/sheets/:id/cells — очистить диапазон
 * Body: { startRow: number, endRow: number, columnIds: string[] }
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { startRow: number; endRow: number; columnIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const startRow = Number(body.startRow);
  const endRow = Number(body.endRow);
  const columnIds = Array.isArray(body.columnIds) ? body.columnIds.filter((c: string) => sheet.columns.some((col) => col.id === c)) : [];
  if (!Number.isFinite(startRow) || !Number.isFinite(endRow) || columnIds.length === 0) {
    return NextResponse.json({ error: "startRow, endRow and columnIds required" }, { status: 400 });
  }

  const result = await prisma.sheetCell.deleteMany({
    where: {
      sheetId: id,
      columnId: { in: columnIds },
      rowIndex: { gte: startRow, lte: endRow },
    },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
