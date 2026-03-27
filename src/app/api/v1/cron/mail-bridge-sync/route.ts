import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMailBridgeAccount } from "@/lib/mail-bridge/sync";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.mailBridgeAccount.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  let ok = 0;
  let failed = 0;
  for (const a of accounts) {
    const r = await syncMailBridgeAccount(a.id);
    if (r.ok) ok += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    syncedOk: ok,
    syncedFailed: failed,
  });
}
