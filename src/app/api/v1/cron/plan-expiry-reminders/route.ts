import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";

const SUBSCRIPTION_DAYS = 30;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sent7: string[] = [];
    const sent3: string[] = [];

    const lastPayments = await prisma.payment.groupBy({
      by: ["userId"],
      where: { status: "succeeded", paidAt: { not: null } },
      _max: { paidAt: true },
    });

    for (const row of lastPayments) {
      const paidAt = row._max.paidAt;
      if (!paidAt) continue;

      const expiry = new Date(paidAt);
      expiry.setDate(expiry.getDate() + SUBSCRIPTION_DAYS);
      const daysLeft = Math.round(
        (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      const payment = await prisma.payment.findFirst({
        where: { userId: row.userId, status: "succeeded", paidAt },
        select: { plan: { select: { name: true } } },
      });
      const planName = payment?.plan?.name ?? "";

      if (daysLeft === 7) {
        const ok = await sendUserTelegramNotify(row.userId, "plan_expiry_7d", {
          planName,
        });
        if (ok) sent7.push(row.userId);
      } else if (daysLeft === 3) {
        const ok = await sendUserTelegramNotify(row.userId, "plan_expiry_3d", {
          planName,
        });
        if (ok) sent3.push(row.userId);
      }
    }

    return NextResponse.json({
      ok: true,
      plan_expiry_7d: { sent: sent7.length, userIds: sent7 },
      plan_expiry_3d: { sent: sent3.length, userIds: sent3 },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
