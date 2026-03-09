/**
 * Telegram bot notifications for admin.
 * Used for: new user registration, successful payment.
 */

import { configStore } from "./config-store";

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramConfig {
  botToken: string | null;
  chatId: string | null;
  notifyRegisterEnabled: boolean;
  notifyPaymentEnabled: boolean;
  notifySpamRegistrationEnabled: boolean;
  registerMessage: string;
  paymentMessage: string;
  spamRegistrationMessage: string;
}

export const DEFAULT_REGISTER_MESSAGE = `🆕 Новый пользователь
Email: {email}
Имя: {name}`;

export const DEFAULT_PAYMENT_MESSAGE = `💰 Оплата тарифа
Пользователь: {userEmail} ({userName})
Тариф: {planName}
Сумма: {amount} {currency}`;

export const DEFAULT_SPAM_REGISTRATION_MESSAGE = `🚨 Подозрение на спам-регистрации
Источник: {rootUserEmail}
Серьезность: {severity}
Score: {score}
Регистраций за окно: {registrationsCount}
Подтверждение email: {verificationRate}%
Активность (login): {activityRate}%
Уникальных доменов: {uniqueDomains}
Причины: {reasons}
Период: {windowStart} — {windowEnd}`;

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const [
    botToken,
    chatId,
    notifyRegister,
    notifyPayment,
    notifySpamRegistration,
    registerMsg,
    paymentMsg,
    spamRegistrationMsg,
  ] =
    await Promise.all([
      configStore.get("telegram.bot_token"),
      configStore.get("telegram.chat_id"),
      configStore.get("telegram.notify_register_enabled"),
      configStore.get("telegram.notify_payment_enabled"),
      configStore.get("telegram.notify_spam_registration_enabled"),
      configStore.get("telegram.register_message"),
      configStore.get("telegram.payment_message"),
      configStore.get("telegram.spam_registration_message"),
    ]);

  return {
    botToken: botToken || null,
    chatId: chatId || null,
    notifyRegisterEnabled: notifyRegister === "true",
    notifyPaymentEnabled: notifyPayment === "true",
    notifySpamRegistrationEnabled: notifySpamRegistration !== "false",
    registerMessage: registerMsg || DEFAULT_REGISTER_MESSAGE,
    paymentMessage: paymentMsg || DEFAULT_PAYMENT_MESSAGE,
    spamRegistrationMessage:
      spamRegistrationMsg || DEFAULT_SPAM_REGISTRATION_MESSAGE,
  };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: undefined,
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return data?.ok === true;
  } catch {
    return false;
  }
}

export function formatRegisterMessage(
  template: string,
  vars: { email: string; name?: string | null }
): string {
  return template
    .replace(/\{email\}/g, vars.email || "")
    .replace(/\{name\}/g, vars.name ?? "");
}

export function formatPaymentMessage(
  template: string,
  vars: {
    userEmail: string;
    userName?: string | null;
    planName: string;
    amount: number;
    currency: string;
  }
): string {
  return template
    .replace(/\{userEmail\}/g, vars.userEmail || "")
    .replace(/\{userName\}/g, vars.userName ?? "")
    .replace(/\{planName\}/g, vars.planName || "")
    .replace(/\{amount\}/g, String(vars.amount))
    .replace(/\{currency\}/g, vars.currency || "RUB");
}

export function formatSpamRegistrationMessage(
  template: string,
  vars: {
    rootUserEmail: string;
    severity: "WARNING" | "CRITICAL";
    score: number;
    registrationsCount: number;
    verificationRate: number;
    activityRate: number;
    uniqueDomains: number;
    reasons: string[];
    windowStart: string;
    windowEnd: string;
  }
): string {
  const reasons = vars.reasons.length > 0 ? vars.reasons.join("; ") : "—";
  return template
    .replace(/\{rootUserEmail\}/g, vars.rootUserEmail || "unknown")
    .replace(/\{severity\}/g, vars.severity)
    .replace(/\{score\}/g, String(vars.score))
    .replace(/\{registrationsCount\}/g, String(vars.registrationsCount))
    .replace(/\{verificationRate\}/g, String(vars.verificationRate))
    .replace(/\{activityRate\}/g, String(vars.activityRate))
    .replace(/\{uniqueDomains\}/g, String(vars.uniqueDomains))
    .replace(/\{reasons\}/g, reasons)
    .replace(/\{windowStart\}/g, vars.windowStart)
    .replace(/\{windowEnd\}/g, vars.windowEnd);
}
