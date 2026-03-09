import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [emailReg, inviteReg, tgWidget, tgQr, tgDomain, tgBotUsername] = await Promise.all([
    configStore.get("auth.email_registration_enabled"),
    configStore.get("auth.invite_registration_enabled"),
    configStore.get("auth.telegram_widget_enabled"),
    configStore.get("auth.telegram_qr_enabled"),
    configStore.get("auth.telegram_domain"),
    configStore.get("auth.telegram_bot_username"),
  ]);

  return NextResponse.json({
    emailRegistrationEnabled: emailReg !== "false",
    inviteRegistrationEnabled: inviteReg === "true",
    telegramWidgetEnabled: tgWidget === "true",
    telegramQrEnabled: tgQr === "true",
    telegramDomain: tgDomain || "qoqon.ru",
    telegramBotUsername: tgBotUsername || "",
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
  const {
    emailRegistrationEnabled,
    inviteRegistrationEnabled,
    telegramWidgetEnabled,
    telegramQrEnabled,
    telegramDomain,
    telegramBotUsername,
  } = body;

  const updates: Promise<void>[] = [];

  if (typeof emailRegistrationEnabled === "boolean") {
    updates.push(
      configStore.set("auth.email_registration_enabled", emailRegistrationEnabled ? "true" : "false", {
        category: "auth",
        description: "Регистрация по email",
      })
    );
  }
  if (typeof inviteRegistrationEnabled === "boolean") {
    updates.push(
      configStore.set("auth.invite_registration_enabled", inviteRegistrationEnabled ? "true" : "false", {
        category: "auth",
        description: "Регистрация только по инвайтам",
      })
    );
  }
  if (typeof telegramWidgetEnabled === "boolean") {
    updates.push(
      configStore.set("auth.telegram_widget_enabled", telegramWidgetEnabled ? "true" : "false", {
        category: "auth",
        description: "Вход через Telegram (кнопка)",
      })
    );
  }
  if (typeof telegramQrEnabled === "boolean") {
    updates.push(
      configStore.set("auth.telegram_qr_enabled", telegramQrEnabled ? "true" : "false", {
        category: "auth",
        description: "Вход через Telegram (QR)",
      })
    );
  }
  if (telegramDomain != null && typeof telegramDomain === "string") {
    updates.push(
      configStore.set("auth.telegram_domain", String(telegramDomain).trim() || "qoqon.ru", {
        category: "auth",
        description: "Домен для Telegram Login Widget",
      })
    );
  }
  if (telegramBotUsername != null && typeof telegramBotUsername === "string") {
    updates.push(
      configStore.set("auth.telegram_bot_username", String(telegramBotUsername).trim(), {
        category: "auth",
        description: "Имя бота для виджета (@username без @)",
      })
    );
  }

  await Promise.all(updates);

  ["auth.email_registration_enabled", "auth.invite_registration_enabled", "auth.telegram_widget_enabled", "auth.telegram_qr_enabled", "auth.telegram_domain", "auth.telegram_bot_username"].forEach((k) =>
    configStore.invalidate(k)
  );

  return NextResponse.json({ ok: true });
}
