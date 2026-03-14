import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getTelegramConfig, sendTelegramMessage, sendTelegramMedia, type MediaType } from "@/lib/telegram";

/** GET - количество пользователей с Telegram */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const count = await prisma.user.count({
    where: { telegramUserId: { not: null } },
  });
  return NextResponse.json({ count });
}

/** POST - рассылка всем пользователям с привязанным Telegram */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : null;
  const mediaType = (["photo", "document", "video"] as const).includes(body.mediaType)
    ? body.mediaType
    : null;

  if (!text && !mediaUrl) {
    return NextResponse.json(
      { error: "Укажите текст и/или ссылку на медиа" },
      { status: 400 }
    );
  }

  const tg = await getTelegramConfig();
  if (!tg.botToken) {
    return NextResponse.json(
      { error: "Токен бота не настроен" },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: { telegramUserId: { not: null } },
    select: { id: true, telegramUserId: true },
  });

  const results: { userId: string; ok: boolean }[] = [];
  let sent = 0;
  let failed = 0;

  for (const u of users) {
    const chatId = String(u.telegramUserId!);
    let ok = false;

    if (mediaUrl && mediaType) {
      ok = await sendTelegramMedia(
        tg.botToken,
        chatId,
        mediaUrl,
        mediaType as MediaType,
        text || undefined
      );
    } else {
      ok = await sendTelegramMessage(tg.botToken, chatId, text);
    }

    results.push({ userId: u.id, ok });
    if (ok) sent++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    total: users.length,
    sent,
    failed,
    results,
  });
}
