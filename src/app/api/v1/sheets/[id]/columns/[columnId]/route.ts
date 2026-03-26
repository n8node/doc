import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbTarget } from "@/lib/n8n-db/client";
import { renameSheetColumnInN8n } from "@/lib/n8n-db/sheet-sync";
import { pushSheetToAllN8nConnections } from "@/lib/n8n-db/sheet-n8n-bridge";

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

  if (typeof data.name === "string") {
    const columnsWithNewName = sheet.columns.map((c) =>
      c.id === columnId ? { id: c.id, order: c.order, name: updated.name } : { id: c.id, order: c.order, name: c.name }
    );
    const sorted = [...columnsWithNewName].sort((a, b) => a.order - b.order);
    const columnIndex = sorted.findIndex((c) => c.id === columnId);
    if (columnIndex >= 0) {
      const connections = await prisma.n8nTableConnection.findMany({
        where: { sheetId, userId: session.user.id },
        select: { tableName: true, target: true },
      });
      for (const conn of connections) {
        const target = isN8nDbTarget(conn.target) ? conn.target : "DEFAULT";
        try {
          await renameSheetColumnInN8n(
            conn.tableName,
            columnIndex,
            updated.name,
            columnsWithNewName,
            target
          );
        } catch (err) {
          console.error("[sheets PATCH column] rename in n8n-db:", err);
        }
      }
    }
  }

  if (data.name === undefined) {
    try {
      await pushSheetToAllN8nConnections(sheetId, session.user.id);
    } catch (err) {
      console.error("[sheets PATCH column] push to n8n-db:", err);
    }
  }

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
  try {
    await pushSheetToAllN8nConnections(sheetId, session.user.id);
  } catch (err) {
    console.error("[sheets DELETE column] push to n8n-db:", err);
  }
  return NextResponse.json({ ok: true });
}
