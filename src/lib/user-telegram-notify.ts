/**
 * Telegram notifications to users (DM) when telegramUserId is linked.
 * Templates stored in AdminConfig, editable in admin.
 */

import { configStore } from "./config-store";
import { getTelegramConfig, sendTelegramMessage } from "./telegram";
import { prisma } from "./prisma";

const TEMPLATE_KEYS = {
  llm_topup: "telegram.user.llm_topup",
  plan_subscribe: "telegram.user.plan_subscribe",
  plan_expiry_7d: "telegram.user.plan_expiry_7d",
  plan_expiry_3d: "telegram.user.plan_expiry_3d",
  support_reply: "telegram.user.support_reply",
  vectorize_done: "telegram.user.vectorize_done",
  share_onetime_viewed: "telegram.user.share_onetime_viewed",
  free_plan_expiry: "telegram.user.free_plan_expiry",
} as const;

const DEFAULTS: Record<keyof typeof TEMPLATE_KEYS, string> = {
  llm_topup: "💰 Баланс LLM пополнен на {amount} ₽. Текущий баланс: {balance} ₽.",
  plan_subscribe: "✅ Подписка на тариф «{planName}» активирована. Спасибо!",
  plan_expiry_7d: "⏰ Тариф «{planName}» истекает через 7 дней. Продлите подписку в личном кабинете: {appUrl}/dashboard/plans",
  plan_expiry_3d: "⏰ Тариф «{planName}» истекает через 3 дня! Продлите: {appUrl}/dashboard/plans",
  support_reply: "💬 Новый ответ в тикете «{themeName}». Открыть: {ticketUrl}",
  vectorize_done: "✅ Векторизация «{collectionName}» завершена. Обработано {succeeded} из {total} файлов.",
  share_onetime_viewed: "👁 Одноразовая ссылка на «{targetName}» просмотрена.",
  free_plan_expiry: "⏰ Бесплатный период закончился. Перейдите на платный тариф: {appUrl}/dashboard/plans",
};

export async function sendUserTelegramNotify(
  userId: string,
  templateKey: keyof typeof TEMPLATE_KEYS,
  vars: Record<string, string | number>
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramUserId: true, preferences: true },
  });
  if (!user?.telegramUserId) return false;

  const prefs = user.preferences as Record<string, unknown> | null;
  const notifications = prefs?.notifications as Record<string, boolean> | undefined;
  if (notifications?.telegram === false) return false;

  const tg = await getTelegramConfig();
  if (!tg.botToken) return false;

  const configKey = TEMPLATE_KEYS[templateKey];
  const template = (await configStore.get(configKey)) || DEFAULTS[templateKey];
  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "https://qoqon.ru";
  const allVars = { ...vars, appUrl };
  let text = template;
  for (const [k, v] of Object.entries(allVars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }

  return sendTelegramMessage(tg.botToken, String(user.telegramUserId), text);
}

export { TEMPLATE_KEYS, DEFAULTS };
