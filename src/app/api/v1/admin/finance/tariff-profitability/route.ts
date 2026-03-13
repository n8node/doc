import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getActiveFixedExpensesCents } from "@/lib/finance/expenses";

const TARGET_PROFIT_CENTS = 1000 * 100; // 1000 ₽

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const refDate = new Date();
  const [plans, monthlyFixedCents] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    getActiveFixedExpensesCents(refDate),
  ]);

  const paidPlans = plans.filter((p) => !p.isFree);
  const totalPaidUsers = paidPlans.reduce((s, p) => s + p._count.users, 0);

  const items = plans.map((plan) => {
    const usersCount = plan._count.users;
    const priceMonthlyCents = plan.priceMonthly != null ? plan.priceMonthly * 100 : 0;
    const priceMonthlyRub = plan.priceMonthly ?? 0;

    let allocatedFixedCents = 0;
    if (!plan.isFree && totalPaidUsers > 0 && usersCount > 0) {
      allocatedFixedCents = Math.round((monthlyFixedCents * usersCount) / totalPaidUsers);
    }

    const profitCents = priceMonthlyCents - allocatedFixedCents;
    const profitRub = profitCents / 100;

    let status: "profitable" | "at_risk" | "loss" | "free" = "free";
    if (!plan.isFree) {
      if (profitCents >= TARGET_PROFIT_CENTS) status = "profitable";
      else if (profitCents >= 0) status = "at_risk";
      else status = "loss";
    }

    const minPriceForTarget =
      plan.isFree
        ? null
        : Math.ceil((allocatedFixedCents + TARGET_PROFIT_CENTS) / 100);

    return {
      id: plan.id,
      name: plan.name,
      isFree: plan.isFree,
      usersCount,
      priceMonthlyRub,
      allocatedFixedCents,
      allocatedFixedRub: (allocatedFixedCents / 100).toFixed(2),
      profitCents,
      profitRub: (profitRub).toFixed(2),
      status,
      minPriceForTargetRub: minPriceForTarget,
    };
  });

  return NextResponse.json({
    items,
    totalMonthlyFixedCents: monthlyFixedCents,
    totalPaidUsers,
    targetProfitRub: TARGET_PROFIT_CENTS / 100,
  });
}
