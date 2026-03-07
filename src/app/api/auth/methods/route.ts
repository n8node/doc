import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/telegram-auth";
import { configStore } from "@/lib/config-store";

export const dynamic = "force-dynamic";

/** Public: returns which auth methods are enabled (for login/register pages) */
export async function GET() {
  const [settings, botUsername] = await Promise.all([
    getAuthSettings(),
    configStore.get("auth.telegram_bot_username"),
  ]);
  return NextResponse.json({
    emailRegistrationEnabled: settings.emailRegistrationEnabled,
    telegramWidgetEnabled: settings.telegramWidgetEnabled,
    telegramQrEnabled: settings.telegramQrEnabled,
    telegramDomain: settings.telegramDomain,
    telegramBotUsername: botUsername || "",
  });
}
