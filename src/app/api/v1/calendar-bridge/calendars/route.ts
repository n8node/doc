import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";
import { fetchYandexCalendarsList } from "@/lib/calendar-bridge/sync";

export async function GET() {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.calendarBridgeAccount.findUnique({
    where: { userId_provider: { userId, provider: "YANDEX" } },
  });
  if (!account) {
    return NextResponse.json({ error: "Сначала сохраните подключение к Яндексу" }, { status: 400 });
  }

  const result = await fetchYandexCalendarsList(account.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Ошибка" }, { status: 400 });
  }

  return NextResponse.json({ calendars: result.calendars ?? [] });
}
