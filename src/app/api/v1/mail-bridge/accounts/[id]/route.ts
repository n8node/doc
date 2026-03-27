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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json({ account: accountPublic(account) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const existing = await prisma.mailBridgeAccount.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    label?: string | null;
    syncDaysBack?: number;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let encryptedCredentials = existing.encryptedCredentials;

  if (typeof body.password === "string" && body.password.length > 0) {
    const login = existing.email;
    try {
      await testYandexImap({ login, password: body.password });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "IMAP check failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    encryptedCredentials = encryptYandexCredentials({
      login,
      password: body.password,
    });
  }

  const label =
    body.label === undefined
      ? undefined
      : body.label === null
        ? null
        : typeof body.label === "string"
          ? body.label.trim().slice(0, 120) || null
          : undefined;

  const syncDaysBack =
    typeof body.syncDaysBack === "number" && Number.isFinite(body.syncDaysBack)
      ? Math.min(365, Math.max(1, Math.floor(body.syncDaysBack)))
      : undefined;

  const account = await prisma.mailBridgeAccount.update({
    where: { id },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(syncDaysBack !== undefined ? { syncDaysBack } : {}),
      encryptedCredentials,
      status: "active",
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true, account: accountPublic(account) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const res = await prisma.mailBridgeAccount.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
