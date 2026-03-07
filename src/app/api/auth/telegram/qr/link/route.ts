import { NextRequest, NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";
import { getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { getTelegramConfig, sendTelegramMessage, formatRegisterMessage } from "@/lib/telegram";

/**
 * POST /api/auth/telegram/qr/link
 * Called by the Telegram bot when user sends /start login_<token>.
 * Body: { token, telegramUserId, telegramUsername, firstName?, lastName? }
 * Auth: X-Telegram-Bot-Secret header must match a shared secret (bot token as simple check)
 */
export async function POST(req: NextRequest) {
  try {
    const settings = await getAuthSettings();
    if (!settings.telegramQrEnabled) {
      return NextResponse.json({ error: "Disabled" }, { status: 403 });
    }

    const botToken = await configStore.get("telegram.bot_token");
    if (!botToken) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    const authHeader = req.headers.get("x-telegram-bot-secret");
    if (authHeader !== botToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { token, telegramUserId, telegramUsername, firstName, lastName } = body;

    if (!token || !telegramUserId) {
      return NextResponse.json({ error: "token and telegramUserId required" }, { status: 400 });
    }

    const tgId = BigInt(telegramUserId);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    const record = await prisma.telegramLoginToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    if (record.telegramUserId != null) {
      return NextResponse.json({ ok: true }); // already linked
    }

    let user = await prisma.user.findUnique({
      where: { telegramUserId: tgId },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const freePlan = await prisma.plan.findFirst({ where: { isFree: true } });
      const placeholderEmail = `tg_${tgId}@qoqon.placeholder`;
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
          telegramUserId: tgId,
          telegramUsername: telegramUsername || null,
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

    await prisma.telegramLoginToken.update({
      where: { token },
      data: {
        telegramUserId: tgId,
        telegramUsername: telegramUsername || null,
        telegramFirstName: firstName || null,
        telegramLastName: lastName || null,
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
