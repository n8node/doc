import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAllN8nConnectionsForSheet } from "@/lib/n8n-db/sheet-n8n-bridge";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/sheets/:id/n8n-connections/sync-all
 * Двусторонняя синхронизация со всеми n8n-подключениями листа (pull → push по каждому).
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sheetId } = await ctx.params;
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId: session.user.id },
    select: { id: true },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = await syncAllN8nConnectionsForSheet(sheetId, session.user.id);
  return NextResponse.json({ ok: true, ...result });
}
