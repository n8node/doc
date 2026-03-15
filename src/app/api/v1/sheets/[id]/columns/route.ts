import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

async function getSheetForUser(sheetId: string, userId: string) {
  return prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
}

/**
 * GET /api/v1/sheets/:id/columns — список колонок (дублирует часть GET sheet)
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

  return NextResponse.json({
    columns: sheet.columns.map((c) => ({
      id: c.id,
      order: c.order,
      name: c.name,
      dataType: c.dataType,
      config: c.config,
    })),
  });
}

/**
 * POST /api/v1/sheets/:id/columns — добавить колонку
 * Body: { name: string, dataType?: string, config?: object, order?: number }
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheet = await getSheetForUser(id, session.user.id);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string; dataType?: string; config?: unknown; order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const maxOrder = sheet.columns.length === 0 ? 0 : Math.max(...sheet.columns.map((c) => c.order));
  const order = typeof body.order === "number" ? body.order : maxOrder + 1;
  const name = typeof body.name === "string" ? body.name.trim() : `Колонка ${sheet.columns.length + 1}`;
  const dataType = typeof body.dataType === "string" ? body.dataType : "text";
  const config = body.config && typeof body.config === "object" ? (body.config as object) : undefined;

  const column = await prisma.sheetColumn.create({
    data: {
      sheetId: id,
      order,
      name: name || `Колонка ${sheet.columns.length + 1}`,
      dataType,
      config,
    },
  });

  return NextResponse.json({
    id: column.id,
    order: column.order,
    name: column.name,
    dataType: column.dataType,
    config: column.config,
  });
}
