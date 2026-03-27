import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const row = await prisma.mailBridgeApiKey.findFirst({
    where: { id, userId },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mailBridgeApiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
