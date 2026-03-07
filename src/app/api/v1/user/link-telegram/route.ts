import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { configStore } from "@/lib/config-store";
import { verifyTelegramWidgetHash, getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/user/link-telegram
 * Link Telegram account to existing email account. Requires session.
 * Body: initData from Telegram Login Widget (id, hash, auth_date, first_name, last_name, username, photo_url?)
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const existingByTg = await prisma.user.findUnique({
      where: { telegramUserId },
    });
    if (existingByTg && existingByTg.id !== userId) {
      return NextResponse.json(
        { error: "Этот Telegram уже привязан к другому аккаунту" },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramUserId,
        telegramUsername,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
