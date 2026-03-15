import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; columnId: string }> };

/**
 * PATCH /api/v1/sheets/:id/columns/:columnId — изменить колонку
 * Body: { name?: string, dataType?: string, config?: object, order?: number }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sheetId, columnId } = await ctx.params;
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId: session.user.id },
    include: { columns: true },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const column = sheet.columns.find((c) => c.id === columnId);
  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  let body: { name?: string; dataType?: string; config?: unknown; order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; dataType?: string; config?: object; order?: number } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.dataType === "string") data.dataType = body.dataType;
  if (body.config !== undefined) data.config = body.config && typeof body.config === "object" ? (body.config as object) : undefined;
  if (typeof body.order === "number") data.order = body.order;

  const updated = await prisma.sheetColumn.update({
    where: { id: columnId },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    order: updated.order,
    name: updated.name,
    dataType: updated.dataType,
    config: updated.config,
  });
}

/**
 * DELETE /api/v1/sheets/:id/columns/:columnId
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sheetId, columnId } = await ctx.params;
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId: session.user.id },
    include: { columns: true },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const column = sheet.columns.find((c) => c.id === columnId);
  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  await prisma.sheetColumn.delete({ where: { id: columnId } });
  return NextResponse.json({ ok: true });
}
