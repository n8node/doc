import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCalendarBridgeAccount } from "@/lib/calendar-bridge/sync";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.calendarBridgeAccount.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const a of accounts) {
    const r = await syncCalendarBridgeAccount(a.id);
    results.push({ id: a.id, ok: r.ok, error: r.error });
  }

  return NextResponse.json({
    ok: true,
    processed: accounts.length,
    results,
  });
}
