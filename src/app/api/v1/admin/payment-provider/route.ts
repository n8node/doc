import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import {
  getStoredActivePaymentProvider,
  type ActivePaymentProviderId,
} from "@/lib/payment-active-provider";
import { getYookassaConfig } from "@/lib/yookassa";
import { getRobokassaConfig } from "@/lib/robokassa";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [activeProvider, yookassaReady, robokassaReady] = await Promise.all([
    getStoredActivePaymentProvider(),
    getYookassaConfig().then((c) => !!c),
    getRobokassaConfig().then((c) => !!c),
  ]);

  return NextResponse.json({
    activeProvider,
    yookassaReady,
    robokassaReady,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = body?.activeProvider;
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v !== "yookassa" && v !== "robokassa") {
    return NextResponse.json(
      { error: "activeProvider: yookassa или robokassa" },
      { status: 400 }
    );
  }
  const activeProvider = v as ActivePaymentProviderId;

  if (activeProvider === "yookassa") {
    const y = await getYookassaConfig();
    if (!y) {
      return NextResponse.json(
        { error: "ЮKassa не настроена — сначала укажите Shop ID и ключ." },
        { status: 400 }
      );
    }
  } else {
    const r = await getRobokassaConfig();
    if (!r) {
      return NextResponse.json(
        { error: "Robokassa не настроена — укажите логин и пароли #1 и #2." },
        { status: 400 }
      );
    }
  }

  await configStore.set("payments.active_provider", activeProvider, {
    category: "payments",
    description: "Aktivnyj provajder platezhej",
  });
  configStore.invalidate("payments.active_provider");

  return NextResponse.json({ ok: true, activeProvider });
}
