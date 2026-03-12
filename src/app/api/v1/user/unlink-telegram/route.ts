import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/user/unlink-telegram
 * Unlink Telegram from current user. Requires session.
 * Not allowed if user has placeholder email (would lose login method).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, telegramUserId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.telegramUserId) {
      return NextResponse.json({ error: "Telegram не привязан" }, { status: 400 });
    }

    if (user.email.endsWith("@qoqon.placeholder")) {
      return NextResponse.json(
        {
          error:
            "Сначала привяжите email в разделе «Привязка аккаунтов» ниже, чтобы не потерять доступ к аккаунту. После привязки email вы сможете отвязать Telegram.",
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramUserId: null,
        telegramUsername: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
