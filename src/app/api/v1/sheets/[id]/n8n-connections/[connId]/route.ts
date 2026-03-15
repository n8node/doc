import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbEnabled, type N8nDbTarget } from "@/lib/n8n-db/client";
import { revokeN8nTableConnection } from "@/lib/n8n-db/sheet-sync";

type Ctx = { params: Promise<{ id: string; connId: string }> };

export async function DELETE(_request: NextRequest, ctx: Ctx) {
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
      { error: "Целевое подключение n8n не настроено на сервере" },
      { status: 503 }
    );
  }
  try {
    await revokeN8nTableConnection(conn.dbRoleName, conn.tableName, target);
  } catch (err) {
    console.error("[sheets n8n-connections] Revoke error:", err);
  }
  await prisma.n8nTableConnection.delete({ where: { id: connId } });
  return NextResponse.json({ ok: true });
}
