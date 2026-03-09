import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isN8nDbEnabled, type N8nDbTarget } from "@/lib/n8n-db/client";
import { revokeN8nConnection } from "@/lib/n8n-db/service";

type Ctx = { params: Promise<{ id: string; connId: string }> };

/**
 * DELETE /api/v1/rag/collections/[id]/n8n-connections/[connId] — revoke n8n connection
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: collectionId, connId } = await ctx.params;

  const conn = await prisma.n8nPgConnection.findFirst({
    where: {
      id: connId,
      collectionId,
      userId,
    },
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
    await revokeN8nConnection(conn.dbRoleName, conn.viewName, target);
  } catch (err) {
    console.error("[n8n-connections] Revoke error:", err);
  }

  await prisma.n8nPgConnection.delete({
    where: { id: connId },
  });

  return NextResponse.json({ ok: true });
}
