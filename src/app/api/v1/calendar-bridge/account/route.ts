import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptYandexCredentials } from "@/lib/calendar-bridge/credentials";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";
import { createYandexDavClient } from "@/lib/calendar-bridge/dav-client";

export async function GET() {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.calendarBridgeAccount.findUnique({
    where: {
      userId_provider: { userId, provider: "YANDEX" },
    },
    include: {
      subscriptions: { orderBy: { displayName: "asc" } },
    },
  });

  if (!account) {
    return NextResponse.json({ account: null });
  }

  return NextResponse.json({
    account: {
      id: account.id,
      provider: account.provider,
      status: account.status,
      lastError: account.lastError,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      subscriptions: account.subscriptions.map((s) => ({
        id: s.id,
        resourceHref: s.resourceHref,
        displayName: s.displayName,
        enabled: s.enabled,
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const login = typeof body.login === "string" ? body.login.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!login || !password) {
    return NextResponse.json(
      { error: "Укажите логин Яндекса и пароль приложения" },
      { status: 400 }
    );
  }

  try {
    const client = await createYandexDavClient({ login, password });
    await client.fetchCalendars();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось подключиться к CalDAV Яндекса";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const encrypted = encryptYandexCredentials({ login, password });

  const account = await prisma.calendarBridgeAccount.upsert({
    where: {
      userId_provider: { userId, provider: "YANDEX" },
    },
    create: {
      userId,
      provider: "YANDEX",
      encryptedCredentials: encrypted,
      status: "active",
      lastError: null,
    },
    update: {
      encryptedCredentials: encrypted,
      status: "active",
      lastError: null,
    },
  });

  return NextResponse.json({
    ok: true,
    accountId: account.id,
  });
}

export async function DELETE() {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.calendarBridgeAccount.deleteMany({
    where: { userId, provider: "YANDEX" },
  });

  return NextResponse.json({ ok: true });
}
