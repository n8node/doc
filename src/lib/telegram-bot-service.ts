/**
 * Telegram bot for QR login - runs in-process.
 * Controlled via admin API: start/stop.
 */

import { configStore } from "./config-store";
import { getAuthSettings } from "./telegram-auth";

const TELEGRAM_API = "https://api.telegram.org";

let running = false;
let shouldStop = false;
let loopPromise: Promise<void> | null = null;

async function getBotToken(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_TOKEN;
  if (fromEnv?.trim()) return fromEnv.trim();
  return configStore.get("telegram.bot_token");
}

async function getUpdates(botToken: string, offset: number): Promise<unknown> {
  const url = `${TELEGRAM_API}/bot${botToken}/getUpdates?offset=${offset}&timeout=30`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "getUpdates failed");
  return data;
}

async function callLinkApi(
  baseUrl: string,
  botToken: string,
  payload: {
    token: string;
    telegramUserId: string;
    telegramUsername?: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/auth/telegram/qr/link`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Secret": botToken,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram-bot] Link API error:", err);
    return false;
  }
}

async function pollLoop() {
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "https://qoqon.ru";
  let offset = 0;

  while (!shouldStop) {
    try {
      const botToken = await getBotToken();
      if (!botToken) {
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }

      const settings = await getAuthSettings();
      if (!settings.telegramQrEnabled) {
        await new Promise((r) => setTimeout(r, 30000));
        continue;
      }

      const data = (await getUpdates(botToken, offset)) as {
        result?: Array<{
          update_id: number;
          message?: {
            text?: string;
            from?: {
              id: number;
              username?: string;
              first_name?: string;
              last_name?: string;
            };
          };
        }>;
      };

      const updates = data?.result ?? [];
      for (const u of updates) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text?.startsWith("/start ")) continue;

        const rest = msg.text.slice(7).trim();
        if (!rest.startsWith("login_")) continue;

        const token = rest.slice(6);
        const from = msg.from;
        if (!from) continue;

        const ok = await callLinkApi(baseUrl, botToken, {
          token,
          telegramUserId: String(from.id),
          telegramUsername: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
        });

        if (ok) {
          console.log("[telegram-bot] Linked:", from.id, from.username);
        } else {
          console.warn("[telegram-bot] Link failed for token");
        }
      }
    } catch (err) {
      if (!shouldStop) console.error("[telegram-bot] Error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  running = false;
  loopPromise = null;
}

export async function startTelegramBot(): Promise<{ ok: boolean; message: string }> {
  if (running) {
    return { ok: true, message: "Бот уже запущен" };
  }

  const token = await getBotToken();
  if (!token) {
    return { ok: false, message: "Нет токена бота. Укажите в настройках Telegram или TELEGRAM_BOT_TOKEN" };
  }

  const settings = await getAuthSettings();
  if (!settings.telegramQrEnabled) {
    return { ok: false, message: "Включите «Вход через QR» в настройках Авторизации" };
  }

  await configStore.set("telegram.bot_auto_start", "true");
  shouldStop = false;
  running = true;
  loopPromise = pollLoop();
  console.log("[telegram-bot] Started (in-process)");
  return { ok: true, message: "Бот запущен" };
}

export async function stopTelegramBot(): Promise<{ ok: boolean; message: string }> {
  if (!running) {
    return { ok: true, message: "Бот не запущен" };
  }
  await configStore.set("telegram.bot_auto_start", "false");
  shouldStop = true;
  await loopPromise;
  console.log("[telegram-bot] Stopped");
  return { ok: true, message: "Бот остановлен" };
}

export function isTelegramBotRunning(): boolean {
  return running;
}
