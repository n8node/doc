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
  registerMessage: string;
  paymentMessage: string;
}

export const DEFAULT_REGISTER_MESSAGE = `🆕 Новый пользователь
Email: {email}
Имя: {name}`;

export const DEFAULT_PAYMENT_MESSAGE = `💰 Оплата тарифа
Пользователь: {userEmail} ({userName})
Тариф: {planName}
Сумма: {amount} {currency}`;

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const [botToken, chatId, notifyRegister, notifyPayment, registerMsg, paymentMsg] =
    await Promise.all([
      configStore.get("telegram.bot_token"),
      configStore.get("telegram.chat_id"),
      configStore.get("telegram.notify_register_enabled"),
      configStore.get("telegram.notify_payment_enabled"),
      configStore.get("telegram.register_message"),
      configStore.get("telegram.payment_message"),
    ]);

  return {
    botToken: botToken || null,
    chatId: chatId || null,
    notifyRegisterEnabled: notifyRegister === "true",
    notifyPaymentEnabled: notifyPayment === "true",
    registerMessage: registerMsg || DEFAULT_REGISTER_MESSAGE,
    paymentMessage: paymentMsg || DEFAULT_PAYMENT_MESSAGE,
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
