import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startTelegramBot, stopTelegramBot, isTelegramBotRunning } from "@/lib/telegram-bot-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ running: isTelegramBotRunning() });
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
