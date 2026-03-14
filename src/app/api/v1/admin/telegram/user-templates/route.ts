import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { TEMPLATE_KEYS, DEFAULTS } from "@/lib/user-telegram-notify";

const KEYS = Object.keys(TEMPLATE_KEYS) as (keyof typeof TEMPLATE_KEYS)[];

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates: Record<string, { key: string; value: string; default: string }> = {};
  for (const k of KEYS) {
    const configKey = TEMPLATE_KEYS[k as keyof typeof TEMPLATE_KEYS];
    const value = await configStore.get(configKey);
    templates[k] = {
      key: configKey,
      value: value ?? "",
      default: DEFAULTS[k],
    };
  }
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const templates = body.templates as Record<string, string> | undefined;

  if (!templates || typeof templates !== "object") {
    return NextResponse.json(
      { error: "templates должен быть объектом" },
      { status: 400 }
    );
  }

  for (const k of KEYS) {
    const configKey = TEMPLATE_KEYS[k as keyof typeof TEMPLATE_KEYS];
    const val = templates[configKey] ?? templates[k];
    if (typeof val === "string") {
      await configStore.set(configKey, val.trim(), {
        category: "notifications",
        description: `Шаблон Telegram для пользователей: ${k}`,
      });
      configStore.invalidate(configKey);
    }
  }

  return NextResponse.json({ ok: true });
}
