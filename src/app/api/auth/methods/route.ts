import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/telegram-auth";
import { configStore } from "@/lib/config-store";
import { getBrandingConfig } from "@/lib/branding";

export const dynamic = "force-dynamic";

/** Public: returns which auth methods are enabled (for login/register pages) */
export async function GET() {
  const [settings, botUsername, branding] = await Promise.all([
    getAuthSettings(),
    configStore.get("auth.telegram_bot_username"),
    getBrandingConfig(),
  ]);
  return NextResponse.json({
    emailRegistrationEnabled: settings.emailRegistrationEnabled,
    emailVerificationRequired: settings.emailVerificationRequired,
    inviteRegistrationEnabled: settings.inviteRegistrationEnabled,
    telegramWidgetEnabled: settings.telegramWidgetEnabled,
    telegramQrEnabled: settings.telegramQrEnabled,
    telegramDomain: settings.telegramDomain,
    telegramBotUsername: botUsername || "",
    siteName: branding.siteName,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
  });
}
