import { NextRequest, NextResponse } from "next/server";
import { encryptYandexCredentials } from "@/lib/calendar-bridge/credentials";
import { prisma } from "@/lib/prisma";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";
import { testYandexImap } from "@/lib/mail-bridge/imap-test";

function accountPublic(a: {
  id: string;
  email: string;
  label: string | null;
  status: string;
  lastError: string | null;
  lastSyncedAt: Date | null;
  syncDaysBack: number;
  createdAt: Date;
}) {
  return {
    id: a.id,
    email: a.email,
    label: a.label,
    status: a.status,
    lastError: a.lastError,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    syncDaysBack: a.syncDaysBack,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function GET() {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await prisma.mailBridgeAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts: list.map(accountPublic) });
}

export async function POST(req: NextRequest) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    password?: string;
    label?: string | null;
    syncDaysBack?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!emailRaw || !password) {
    return NextResponse.json(
      { error: "Укажите email Яндекса и пароль приложения" },
      { status: 400 }
    );
  }

  try {
    await testYandexImap({ login: emailRaw, password });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось подключиться к IMAP Яндекса";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const label =
    typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : null;
  const syncDaysBack =
    typeof body.syncDaysBack === "number" && Number.isFinite(body.syncDaysBack)
      ? Math.min(365, Math.max(1, Math.floor(body.syncDaysBack)))
      : 90;

  const encrypted = encryptYandexCredentials({ login: emailRaw, password });

  try {
    const account = await prisma.mailBridgeAccount.create({
      data: {
        userId,
        provider: "YANDEX",
        email: emailRaw,
        label,
        encryptedCredentials: encrypted,
        status: "active",
        lastError: null,
        syncDaysBack,
      },
    });

    return NextResponse.json({ ok: true, account: accountPublic(account) });
  } catch {
    return NextResponse.json(
      { error: "Этот ящик уже подключён или данные не сохранились" },
      { status: 409 }
    );
  }
}
