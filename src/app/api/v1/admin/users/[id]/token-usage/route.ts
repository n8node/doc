import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getPlanTokenQuotas,
  getTokenUsageSummary,
  getTotalQuota,
  getUserBillingContext,
} from "@/lib/ai/token-usage";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await ctx.params;
  const billing = await getUserBillingContext(userId);
  if (!billing) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const [current, allTime, recent] = await Promise.all([
    getTokenUsageSummary(userId, { since: billing.cycleStart }),
    getTokenUsageSummary(userId),
    prisma.tokenUsageEvent.findMany({
      where: { userId, isBillable: true, createdAt: { gte: billing.cycleStart } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        category: true,
        provider: true,
        model: true,
        sourceType: true,
        tokensIn: true,
        tokensOut: true,
        tokensTotal: true,
        createdAt: true,
      },
    }),
  ]);

  const quotas = getPlanTokenQuotas(billing.plan);
  const totalQuota = getTotalQuota(quotas);

  return NextResponse.json({
    anchorType: billing.anchorType,
    anchorDate: billing.anchorDate,
    cycleStart: billing.cycleStart,
    cycleEnd: billing.cycleEnd,
    quotas,
    currentCycle: {
      ...current,
      totalQuota,
      totalRemaining:
        totalQuota != null ? Math.max(0, totalQuota - current.totalTokens) : null,
    },
    allTime,
    recentEvents: recent,
  });
}
