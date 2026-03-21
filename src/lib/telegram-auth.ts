/**
 * Telegram Login Widget and QR auth verification.
 */

import { createHmac, createHash } from "crypto";
import { configStore } from "./config-store";
import { resolveVkOAuthCredentials } from "./vk-oauth";

export interface AuthSettings {
  emailRegistrationEnabled: boolean;
  emailVerificationRequired: boolean;
  inviteRegistrationEnabled: boolean;
  telegramWidgetEnabled: boolean;
  telegramQrEnabled: boolean;
  telegramDomain: string;
  telegramBotUsername?: string;
  /** Вход и регистрация через VK OAuth (нужны VK_CLIENT_ID / VK_CLIENT_SECRET и не auth.vk_oauth_enabled=false) */
  vkOAuthEnabled: boolean;
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const [emailReg, emailVerify, inviteReg, tgWidget, tgQr, tgDomain, vkFlag, vkCreds] = await Promise.all([
    configStore.get("auth.email_registration_enabled"),
    configStore.get("auth.email_verification_required"),
    configStore.get("auth.invite_registration_enabled"),
    configStore.get("auth.telegram_widget_enabled"),
    configStore.get("auth.telegram_qr_enabled"),
    configStore.get("auth.telegram_domain"),
    configStore.get("auth.vk_oauth_enabled"),
    resolveVkOAuthCredentials(),
  ]);

  return {
    emailRegistrationEnabled: emailReg !== "false",
    emailVerificationRequired: emailVerify !== "false",
    inviteRegistrationEnabled: inviteReg === "true",
    telegramWidgetEnabled: tgWidget === "true",
    telegramQrEnabled: tgQr === "true",
    telegramDomain: tgDomain || "qoqon.ru",
    vkOAuthEnabled:
      vkCreds !== null &&
      (vkFlag !== "false" || process.env.VK_OAUTH_ENABLED === "true"),
  };
}

/**
 * Verify hash from Telegram Login Widget.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramWidgetHash(
  initData: Record<string, string>,
  botToken: string
): boolean {
  const hash = initData.hash;
  if (!hash) return false;

  const authDate = parseInt(initData.auth_date ?? "0", 10);
  if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
    return false; // max 24h
  }

  const keys = Object.keys(initData)
    .filter((k) => k !== "hash")
    .sort();
  const dataCheckString = keys.map((k) => `${k}=${initData[k]}`).join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return computedHash === hash;
}
