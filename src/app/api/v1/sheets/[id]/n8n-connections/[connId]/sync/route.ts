import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbEnabled, type N8nDbTarget } from "@/lib/n8n-db/client";
import { syncOneN8nConnection } from "@/lib/n8n-db/sheet-n8n-bridge";

type Ctx = { params: Promise<{ id: string; connId: string }> };

/**
 * POST /api/v1/sheets/:id/n8n-connections/:connId/sync
 * Two-way: pull from n8n-db into app, then push app state to n8n-db.
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sheetId, connId } = await ctx.params;
  const conn = await prisma.n8nTableConnection.findFirst({
    where: { id: connId, sheetId, userId: session.user.id },
  });
  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  const target = (conn.target as N8nDbTarget) || "DEFAULT";
  if (!isN8nDbEnabled(target)) {
    return NextResponse.json(
      { error: "Подключение n8n не настроено на сервере" },
      { status: 503 }
    );
  }
  try {
    await syncOneN8nConnection(sheetId, session.user.id, conn);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sheets n8n-connections] Sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка синхронизации" },
      { status: 500 }
    );
  }
}
