import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/sheets/:id/export?format=json — экспорт таблицы в JSON
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await prisma.sheet.findFirst({
    where: { id, userId: session.user.id },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") || "json";
  if (format !== "json") {
    return NextResponse.json({ error: "Only format=json supported" }, { status: 400 });
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
  const rows = rowIndexes.map((rowIndex) => {
    const cellsMap = byRow.get(rowIndex) ?? {};
    const obj: Record<string, string | null> = { _rowIndex: String(rowIndex) };
    for (const col of sheet.columns) {
      obj[col.name] = cellsMap[col.id] ?? null;
    }
    return obj;
  });

  const payload = {
    name: sheet.name,
    columns: sheet.columns.map((c) => ({
      id: c.id,
      name: c.name,
      dataType: c.dataType,
      config: c.config,
    })),
    rows,
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(sheet.name)}.json"`,
    },
  });
}
