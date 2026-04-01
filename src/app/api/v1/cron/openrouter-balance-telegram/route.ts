import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterActivityManagementKey } from "@/lib/marketplace/openrouter-activity";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

type CreditsBody = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
  error?: { message?: string };
};

/**
 * POST /api/v1/cron/openrouter-balance-telegram
 * Запрос баланса OpenRouter (Management API /credits) и отправка сводки в Telegram админу.
 * Планировщик: раз в сутки curl с Authorization: Bearer CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tg = await getTelegramConfig();
  if (!tg.botToken || !tg.chatId) {
    return NextResponse.json(
      { ok: false, error: "Telegram не настроен (telegram.bot_token / telegram.chat_id)" },
      { status: 503 }
    );
  }

  const apiKey = await getOpenRouterActivityManagementKey();
  if (!apiKey) {
    const text =
      "⚠️ OpenRouter (ежедневно): Management API ключ не задан.\n" +
      "Админка → Настройки → Маркетплейс → OpenRouter Activity API.";
    const sent = await sendTelegramMessage(tg.botToken, tg.chatId, text);
    return NextResponse.json({
      ok: false,
      error: "OPENROUTER_MANAGEMENT_KEY_NOT_SET",
      telegramSent: sent,
    });
  }

  try {
    const res = await fetch(OPENROUTER_CREDITS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    });
    const data = (await res.json().catch(() => ({}))) as CreditsBody;

    const stamp = new Date().toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      dateStyle: "short",
      timeStyle: "short",
    });

    let text: string;
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      text = `⚠️ OpenRouter баланс\nОшибка API: ${errMsg}\n${stamp}`;
    } else {
      const total = data?.data?.total_credits;
      const usage = data?.data?.total_usage;
      const creditsLine =
        typeof total === "number" ? `Остаток кредитов: $${total.toFixed(4)}` : "Остаток: —";
      const usageLine =
        typeof usage === "number" ? `Всего использовано: $${usage.toFixed(4)}` : null;
      text = ["📊 OpenRouter — баланс", creditsLine, usageLine, stamp]
        .filter(Boolean)
        .join("\n");
    }

    const sent = await sendTelegramMessage(tg.botToken, tg.chatId, text);
    return NextResponse.json({
      ok: sent && res.ok,
      telegramSent: sent,
      creditsHttpOk: res.ok,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await sendTelegramMessage(
      tg.botToken,
      tg.chatId,
      `⚠️ OpenRouter баланс: сбой запроса\n${msg}`
    );
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
