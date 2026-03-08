import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startTelegramBot, stopTelegramBot, isTelegramBotRunning } from "@/lib/telegram-bot-service";
import { configStore } from "@/lib/config-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const autoStartFromEnv = process.env.TELEGRAM_BOT_AUTO_START === "true";
  const autoStartFromConfig = (await configStore.get("telegram.bot_auto_start")) === "true";
  const autoStartEnabled = autoStartFromEnv || autoStartFromConfig;
  const autoStartSource = autoStartFromEnv ? "env" : autoStartFromConfig ? "config" : null;
  return NextResponse.json({
    running: isTelegramBotRunning(),
    autoStartEnabled,
    autoStartSource,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "start") {
    const result = await startTelegramBot();
    return NextResponse.json(result);
  }
  if (action === "stop") {
    const result = await stopTelegramBot();
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false, message: "Неизвестное действие" }, { status: 400 });
}
