import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import {
  getPlanTokenQuotas,
  getTokenUsageSummary,
  getTotalQuota,
  getUserBillingContext,
} from "@/lib/ai/token-usage";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billing = await getUserBillingContext(userId);
  if (!billing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [current, sinceRegistration, recent] = await Promise.all([
    getTokenUsageSummary(userId, { since: billing.cycleStart }),
    getTokenUsageSummary(userId, { since: billing.anchorType === "registration" ? billing.anchorDate : undefined }),
    prisma.tokenUsageEvent.findMany({
      where: {
        userId,
        isBillable: true,
        createdAt: { gte: billing.cycleStart },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        category: true,
        model: true,
        provider: true,
        sourceType: true,
        sourceId: true,
        tokensIn: true,
        tokensOut: true,
        tokensTotal: true,
        createdAt: true,
      },
    }),
  ]);

  const quotas = getPlanTokenQuotas(billing.plan);
  const totalQuota = getTotalQuota(quotas);
  const totalUsed = current.totalTokens;
  const totalRemaining = totalQuota != null ? Math.max(0, totalQuota - totalUsed) : null;

  return NextResponse.json({
    plan: billing.plan,
    anchorType: billing.anchorType,
    anchorDate: billing.anchorDate,
    cycleStart: billing.cycleStart,
    cycleEnd: billing.cycleEnd,
    quotas,
    total: {
      quota: totalQuota,
      used: totalUsed,
      remaining: totalRemaining,
    },
    currentCycle: current,
    sinceAnchor: sinceRegistration,
    recentEvents: recent,
  });
}
