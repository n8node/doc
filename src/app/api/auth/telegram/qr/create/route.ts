import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/telegram/qr/create
 * Create a login token for QR flow. Returns { token, startParam } for QR link.
 */
export async function POST() {
  try {
    const settings = await getAuthSettings();
    if (!settings.telegramQrEnabled) {
      return NextResponse.json({ error: "Telegram QR login disabled" }, { status: 403 });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.telegramLoginToken.create({
      data: { token, expiresAt },
    });

    return NextResponse.json({
      token,
      startParam: `login_${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}
