import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, refreshAuthOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getNextAuthBaseUrl } from "@/lib/app-url";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    emailReg,
    emailVerify,
    inviteReg,
    tgWidget,
    tgQr,
    tgDomain,
    tgBotUsername,
    vkOAuth,
    vkClientId,
    vkSecretRow,
  ] = await Promise.all([
    configStore.get("auth.email_registration_enabled"),
    configStore.get("auth.email_verification_required"),
    configStore.get("auth.invite_registration_enabled"),
    configStore.get("auth.telegram_widget_enabled"),
    configStore.get("auth.telegram_qr_enabled"),
    configStore.get("auth.telegram_domain"),
    configStore.get("auth.telegram_bot_username"),
    configStore.get("auth.vk_oauth_enabled"),
    configStore.get("auth.vk_client_id"),
    configStore.get("auth.vk_client_secret"),
  ]);

  const vkSecretSet = Boolean(vkSecretRow?.trim() || process.env.VK_CLIENT_SECRET?.trim() || "");

  const vkOAuthRedirectUri = `${getNextAuthBaseUrl()}/api/auth/callback/vk`;

  return NextResponse.json({
    vkOAuthRedirectUri,
    emailRegistrationEnabled: emailReg !== "false",
    emailVerificationRequired: emailVerify !== "false",
    inviteRegistrationEnabled: inviteReg === "true",
    telegramWidgetEnabled: tgWidget === "true",
    telegramQrEnabled: tgQr === "true",
    telegramDomain: tgDomain || "qoqon.ru",
    telegramBotUsername: tgBotUsername || "",
    vkOAuthEnabled: vkOAuth !== "false",
    vkClientId: vkClientId?.trim() || process.env.VK_CLIENT_ID?.trim() || "",
    vkSecretSet,
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
    emailVerificationRequired,
    inviteRegistrationEnabled,
    telegramWidgetEnabled,
    telegramQrEnabled,
    telegramDomain,
    telegramBotUsername,
    vkOAuthEnabled,
    vkClientId,
    vkClientSecret,
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
  if (typeof emailVerificationRequired === "boolean") {
    updates.push(
      configStore.set("auth.email_verification_required", emailVerificationRequired ? "true" : "false", {
        category: "auth",
        description: "Подтверждение email при регистрации",
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
  if (typeof vkOAuthEnabled === "boolean") {
    updates.push(
      configStore.set("auth.vk_oauth_enabled", vkOAuthEnabled ? "true" : "false", {
        category: "auth",
        description: "Вход и регистрация через ВКонтакте (OAuth)",
      })
    );
  }

  if (typeof vkClientId === "string") {
    updates.push(
      configStore.set("auth.vk_client_id", String(vkClientId).trim(), {
        category: "auth",
        description: "VK OAuth Application ID",
      })
    );
  }

  const secretValid =
    vkClientSecret &&
    typeof vkClientSecret === "string" &&
    vkClientSecret.trim() &&
    vkClientSecret !== "••••••••" &&
    vkClientSecret !== "********";

  if (secretValid) {
    updates.push(
      configStore.set("auth.vk_client_secret", String(vkClientSecret).trim(), {
        isEncrypted: true,
        category: "auth",
        description: "VK OAuth защищённый ключ",
      })
    );
  }

  await Promise.all(updates);

  [
    "auth.email_registration_enabled",
    "auth.email_verification_required",
    "auth.invite_registration_enabled",
    "auth.telegram_widget_enabled",
    "auth.telegram_qr_enabled",
    "auth.telegram_domain",
    "auth.telegram_bot_username",
    "auth.vk_oauth_enabled",
    "auth.vk_client_id",
    "auth.vk_client_secret",
  ].forEach((k) => configStore.invalidate(k));

  await refreshAuthOptions().catch((e) => console.warn("[auth] refreshAuthOptions after admin save:", e));

  return NextResponse.json({ ok: true });
}
