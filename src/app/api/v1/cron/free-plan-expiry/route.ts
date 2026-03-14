import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sent: string[] = [];

    const usersWithFreePlan = await prisma.user.findMany({
      where: {
        planId: { not: null },
        plan: {
          isFree: true,
          freePlanDurationDays: { not: null },
        },
      },
      select: {
        id: true,
        createdAt: true,
        plan: { select: { freePlanDurationDays: true } },
      },
    });

    for (const u of usersWithFreePlan) {
      const days = u.plan?.freePlanDurationDays;
      if (!days || days < 1) continue;

      const expiresAt = new Date(u.createdAt);
      expiresAt.setDate(expiresAt.getDate() + days);

      const remainingMs = expiresAt.getTime() - now.getTime();

      // Бесплатный период истёк (сегодня или вчера — одно уведомление)
      if (remainingMs <= 24 * 60 * 60 * 1000 && remainingMs > -24 * 60 * 60 * 1000) {
        const ok = await sendUserTelegramNotify(u.id, "free_plan_expiry", {});
        if (ok) sent.push(u.id);
      }
    }

    return NextResponse.json({
      ok: true,
      sent: sent.length,
      userIds: sent,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
