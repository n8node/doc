import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";
import { syncMailBridgeAccount } from "@/lib/mail-bridge/sync";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const account = await prisma.mailBridgeAccount.findFirst({
    where: { id, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await syncMailBridgeAccount(account.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Sync failed", messagesUpserted: result.messagesUpserted ?? 0 },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    messagesUpserted: result.messagesUpserted ?? 0,
  });
}
