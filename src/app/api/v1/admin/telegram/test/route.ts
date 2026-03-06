import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export async function POST() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = await getTelegramConfig();
  if (!cfg.botToken || !cfg.chatId) {
    return NextResponse.json({
      ok: false,
      message: "Укажите токен бота и ID чата",
    });
  }

  const ok = await sendTelegramMessage(
    cfg.botToken,
    cfg.chatId,
    "🧪 Тестовое сообщение от DOC. Уведомления настроены."
  );

  return NextResponse.json({
    ok,
    message: ok ? "Сообщение отправлено" : "Ошибка отправки. Проверьте токен и chat_id.",
  });
}
