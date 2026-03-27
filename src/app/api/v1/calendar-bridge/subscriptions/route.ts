import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";
import { fetchYandexCalendarsList } from "@/lib/calendar-bridge/sync";
import { normalizeCalendarUrl } from "@/lib/calendar-bridge/dav-client";

export async function PUT(req: NextRequest) {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.calendarBridgeAccount.findUnique({
    where: { userId_provider: { userId, provider: "YANDEX" } },
  });
  if (!account) {
    return NextResponse.json({ error: "Нет подключения к Яндексу" }, { status: 400 });
  }

  let body: { resourceHrefs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hrefs = Array.from(
    new Set(
      Array.isArray(body.resourceHrefs)
        ? body.resourceHrefs.filter((x): x is string => typeof x === "string")
        : []
    )
  );
  if (hrefs.length === 0) {
    return NextResponse.json(
      { error: "Выберите хотя бы один календарь" },
      { status: 400 }
    );
  }

  const remote = await fetchYandexCalendarsList(account.id);
  if (!remote.ok || !remote.calendars) {
    return NextResponse.json({ error: remote.error ?? "Не удалось получить список календарей" }, { status: 400 });
  }

  const byUrl = new Map(
    remote.calendars.map((c) => [normalizeCalendarUrl(c.url), c] as const)
  );

  await prisma.$transaction(async (tx) => {
    await tx.calendarBridgeSubscription.deleteMany({
      where: { accountId: account.id },
    });

    for (const href of hrefs) {
      const n = normalizeCalendarUrl(href);
      const cal = byUrl.get(n);
      await tx.calendarBridgeSubscription.create({
        data: {
          accountId: account.id,
          resourceHref: cal?.url ?? href,
          displayName: cal?.displayName ?? null,
          enabled: true,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
