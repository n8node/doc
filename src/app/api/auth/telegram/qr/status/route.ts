import { NextRequest, NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { createTelegramSessionToken } from "@/lib/telegram-session";

export async function GET(req: NextRequest) {
  try {
    const settings = await getAuthSettings();
    if (!settings.telegramQrEnabled) {
      return NextResponse.json({ error: "Disabled" }, { status: 403 });
    }

    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const record = await prisma.telegramLoginToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ status: "expired" });
    }

    if (record.expiresAt < new Date()) {
      await prisma.telegramLoginToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.json({ status: "expired" });
    }

    if (record.telegramUserId == null) {
      return NextResponse.json({ status: "pending" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramUserId: record.telegramUserId },
    });

    if (!user) {
      return NextResponse.json({ status: "expired" });
    }

    await prisma.telegramLoginToken.delete({ where: { token } }).catch(() => {});

    const sessionToken = createTelegramSessionToken(user.id);

    return NextResponse.json({
      status: "linked",
      sessionToken,
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
