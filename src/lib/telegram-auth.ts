/**
 * Telegram Login Widget and QR auth verification.
 */

import { createHmac, createHash } from "crypto";
import { configStore } from "./config-store";

export interface AuthSettings {
  emailRegistrationEnabled: boolean;
  telegramWidgetEnabled: boolean;
  telegramQrEnabled: boolean;
  telegramDomain: string;
  telegramBotUsername?: string;
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const [emailReg, tgWidget, tgQr, tgDomain] = await Promise.all([
    configStore.get("auth.email_registration_enabled"),
    configStore.get("auth.telegram_widget_enabled"),
    configStore.get("auth.telegram_qr_enabled"),
    configStore.get("auth.telegram_domain"),
  ]);

  return {
    emailRegistrationEnabled: emailReg !== "false",
    telegramWidgetEnabled: tgWidget === "true",
    telegramQrEnabled: tgQr === "true",
    telegramDomain: tgDomain || "qoqon.ru",
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
