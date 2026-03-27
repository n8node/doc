import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeUserId } from "@/lib/mail-bridge-api-auth";
import { mailMessageDetail } from "@/lib/mail-bridge/api-json";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const row = await prisma.mailBridgeMessage.findFirst({
    where: {
      id,
      account: { userId },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: mailMessageDetail(row) });
}
