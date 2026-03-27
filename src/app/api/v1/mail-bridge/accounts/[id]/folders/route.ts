import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";
import { listYandexMailFolders } from "@/lib/mail-bridge/list-folders";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const remote = await listYandexMailFolders(account.encryptedCredentials);
  if (!remote.ok) {
    return NextResponse.json({ error: remote.error }, { status: 400 });
  }

  return NextResponse.json({ folders: remote.folders });
}
