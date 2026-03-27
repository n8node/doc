import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";
import { syncCalendarBridgeAccount } from "@/lib/calendar-bridge/sync";

export async function POST() {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.calendarBridgeAccount.findUnique({
    where: { userId_provider: { userId, provider: "YANDEX" } },
  });
  if (!account) {
    return NextResponse.json({ error: "Нет подключения" }, { status: 400 });
  }

  const result = await syncCalendarBridgeAccount(account.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Ошибка синхронизации" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    eventsUpserted: result.eventsUpserted ?? 0,
  });
}
