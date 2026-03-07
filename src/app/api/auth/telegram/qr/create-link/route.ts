import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getAuthSettings } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/telegram/qr/create-link
 * Create a link token for attaching Telegram to existing account. Requires session.
 * Returns { token, startParam } for QR: t.me/bot?start=link_<token>
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getAuthSettings();
    if (!settings.telegramQrEnabled) {
      return NextResponse.json({ error: "Telegram QR disabled" }, { status: 403 });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.telegramLoginToken.create({
      data: { token, linkUserId: userId, expiresAt },
    });

    return NextResponse.json({
      token,
      startParam: `link_${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
