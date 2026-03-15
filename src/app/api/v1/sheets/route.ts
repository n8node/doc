import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/sheets — список таблиц пользователя
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheets = await prisma.sheet.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { columns: true, cells: true } },
    },
  });

  return NextResponse.json(
    sheets.map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      columnsCount: s._count.columns,
      cellsCount: s._count.cells,
    }))
  );
}

/**
 * POST /api/v1/sheets — создать таблицу
 * Body: { name: string, columns?: Array<{ name: string, dataType?: string, config?: object }> }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; columns?: Array<{ name: string; dataType?: string; config?: unknown }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "Новая таблица";
  const columnsInput = Array.isArray(body.columns) ? body.columns : [];

  const sheet = await prisma.sheet.create({
    data: {
      userId: session.user.id,
      name: name || "Новая таблица",
      columns: {
        create: columnsInput.slice(0, 50).map((c, i) => ({
          order: i,
          name: typeof c.name === "string" ? c.name.trim() || `Колонка ${i + 1}` : `Колонка ${i + 1}`,
          dataType: typeof c.dataType === "string" ? c.dataType : "text",
          config: c.config && typeof c.config === "object" ? (c.config as object) : undefined,
        })),
      },
    },
    include: {
      columns: { orderBy: { order: "asc" } },
    },
  });

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
  });
}
