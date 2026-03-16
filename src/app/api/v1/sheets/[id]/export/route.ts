import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

type Ctx = { params: Promise<{ id: string }> };

function buildRowsData(
  sheet: { columns: { id: string; name: string }[] },
  cells: { columnId: string; rowIndex: number; value: string | null }[]
): { rows: Record<string, string | null>[]; rowIndexes: number[] } {
  const byRow = new Map<number, Record<string, string | null>>();
  for (const c of cells) {
    const row = byRow.get(c.rowIndex) ?? {};
    row[c.columnId] = c.value;
    byRow.set(c.rowIndex, row);
  }
  const rowIndexes = Array.from(byRow.keys()).sort((a, b) => a - b);
  const rows = rowIndexes.map((rowIndex) => {
    const cellsMap = byRow.get(rowIndex) ?? {};
    const obj: Record<string, string | null> = {};
    for (const col of sheet.columns) {
      obj[col.name] = cellsMap[col.id] ?? null;
    }
    return obj;
  });
  return { rows, rowIndexes };
}

function toSqlIdentifier(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "col"
  );
}

function escapeSqlValue(value: string | null): string {
  if (value === null || value === "") return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/** dataType из SheetColumn → тип PostgreSQL */
function dataTypeToSqlType(dataType: string): string {
  switch (dataType) {
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "datetime":
      return "TIMESTAMP";
    case "text":
    case "select":
    default:
      return "TEXT";
  }
}

/**
 * GET /api/v1/sheets/:id/export?format=json|xlsx|sql — экспорт таблицы
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

  const cells = await prisma.sheetCell.findMany({
    where: { sheetId: id },
    select: { columnId: true, rowIndex: true, value: true },
  });

  const format = request.nextUrl.searchParams.get("format") || "json";
  const safeName = sheet.name.replace(/[/\\?*:[\]]/g, "_").trim() || "sheet";
  const { rows, rowIndexes } = buildRowsData(sheet, cells);

  if (format === "json") {
    const payload = {
      name: sheet.name,
      columns: sheet.columns.map((c) => ({
        id: c.id,
        name: c.name,
        dataType: c.dataType,
        config: c.config,
      })),
      rows: rows.map((r, i) => ({ ...r, _rowIndex: String(rowIndexes[i] ?? 0) })),
    };
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.json"`,
      },
    });
  }

  if (format === "xlsx") {
    const headers = sheet.columns.map((c) => c.name);
    const data: (string | null)[][] = [headers];
    for (const row of rows) {
      data.push(sheet.columns.map((col) => row[col.name] ?? null));
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeName.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.xlsx"`,
      },
    });
  }

  if (format === "sql") {
    const tableName = toSqlIdentifier(safeName);
    const colNames = sheet.columns.map((c) => toSqlIdentifier(c.name));
    const used = new Set<string>();
    const uniqueCols = colNames.map((n) => {
      let u = n;
      let i = 0;
      while (used.has(u)) u = `${n}_${++i}`;
      used.add(u);
      return u;
    });
    const colsList = uniqueCols.map((c) => `"${c}"`).join(", ");
    const createDefs = sheet.columns.map(
      (c, i) => `  "${uniqueCols[i]}" ${dataTypeToSqlType(c.dataType)}`
    );
    const parts: string[] = [
      `-- Table: ${sheet.name}`,
      `DROP TABLE IF EXISTS "${tableName}";`,
      `CREATE TABLE "${tableName}" (\n${createDefs.join(",\n")}\n);`,
      "",
    ];
    for (const row of rows) {
      const values = sheet.columns.map((_, i) =>
        escapeSqlValue(row[sheet.columns[i].name] ?? null)
      );
      parts.push(`INSERT INTO "${tableName}" (${colsList}) VALUES (${values.join(", ")});`);
    }
    const sql = parts.join("\n");
    return new NextResponse(sql, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.sql"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use json, xlsx or sql." }, { status: 400 });
}
