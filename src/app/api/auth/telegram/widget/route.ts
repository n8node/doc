import { NextRequest, NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";
import { verifyTelegramWidgetHash, getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { createTelegramSessionToken } from "@/lib/telegram-session";
import { getTelegramConfig, sendTelegramMessage, formatRegisterMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const settings = await getAuthSettings();
    if (!settings.telegramWidgetEnabled) {
      return NextResponse.json({ error: "Telegram login disabled" }, { status: 403 });
    }

    const botToken = await configStore.get("telegram.bot_token");
    if (!botToken) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const initData = body as Record<string, string>;

    if (!verifyTelegramWidgetHash(initData, botToken)) {
      return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
    }

    const telegramUserId = BigInt(initData.id ?? "0");
    const telegramUsername = initData.username || null;
    const firstName = initData.first_name || "";
    const lastName = initData.last_name || "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    let user = await prisma.user.findUnique({
      where: { telegramUserId },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const freePlan = await prisma.plan.findFirst({ where: { isFree: true } });
      const placeholderEmail = `tg_${telegramUserId}@qoqon.placeholder`;
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const passwordHash = await hash(randomPassword, 12);

      user = await prisma.user.create({
        data: {
          email: placeholderEmail,
          passwordHash,
          name: displayName,
          role: "USER",
          planId: freePlan?.id ?? null,
          storageQuota: freePlan?.storageQuota ?? BigInt(25 * 1024 * 1024 * 1024),
          maxFileSize: freePlan?.maxFileSize ?? BigInt(512 * 1024 * 1024),
          telegramUserId,
          telegramUsername,
        },
      });
    }

    if (isNewUser) {
      try {
        const tg = await getTelegramConfig();
        if (tg.notifyRegisterEnabled && tg.botToken && tg.chatId) {
          const displayNameForNotify = [displayName, telegramUsername ? `@${telegramUsername}` : null]
            .filter(Boolean)
            .join(" ")
            .trim() || (telegramUsername ? `@${telegramUsername}` : "—");
          const text = formatRegisterMessage(tg.registerMessage, {
            email: `Telegram (${user.email})`,
            name: displayNameForNotify,
          });
          await sendTelegramMessage(tg.botToken, tg.chatId, text);
        }
      } catch {
        // ignore, do not affect auth
      }
    }

    const sessionToken = createTelegramSessionToken(user.id);

    return NextResponse.json({
      ok: true,
      sessionToken,
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  } catch {
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
