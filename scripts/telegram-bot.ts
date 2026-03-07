/**
 * Telegram bot for QR login - long polling.
 * Run: npx tsx scripts/telegram-bot.ts
 * Or: npm run telegram:bot
 *
 * Requires: TELEGRAM_BOT_TOKEN or telegram.bot_token in admin config.
 * The bot token from admin Telegram settings is used (same as notifications).
 */

import "dotenv/config";
import { configStore } from "../src/lib/config-store";
import { getAuthSettings } from "../src/lib/telegram-auth";

const TELEGRAM_API = "https://api.telegram.org";

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

async function main() {
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "https://qoqon.ru";

  console.log("[telegram-bot] Starting... Base URL:", baseUrl);

  let offset = 0;

  while (true) {
    try {
      const botToken = await getBotToken();
      if (!botToken) {
        console.error("[telegram-bot] No bot token. Set TELEGRAM_BOT_TOKEN or configure in admin.");
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
      console.error("[telegram-bot] Error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch(console.error);
