import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import {
  getPlanTokenQuotas,
  getTokenUsageSummary,
  getTotalQuota,
  getUserBillingContext,
} from "@/lib/ai/token-usage";
import { prisma } from "@/lib/prisma";

type CategoryKey = "CHAT_DOCUMENT" | "SEARCH" | "EMBEDDING" | "TRANSCRIPTION";

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildEmptyCategories(): Record<CategoryKey, number> {
  return {
    CHAT_DOCUMENT: 0,
    SEARCH: 0,
    EMBEDDING: 0,
    TRANSCRIPTION: 0,
  };
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billing = await getUserBillingContext(userId);
  if (!billing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [current, sinceRegistration, recent, currentEvents, firstSucceededPayment, allBillableEvents] = await Promise.all([
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
    prisma.tokenUsageEvent.findMany({
      where: {
        userId,
        isBillable: true,
        createdAt: { gte: billing.cycleStart },
      },
      orderBy: { createdAt: "asc" },
      select: {
        category: true,
        tokensTotal: true,
        createdAt: true,
      },
    }),
    prisma.payment.findFirst({
      where: { userId, status: "succeeded" },
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      select: { paidAt: true, createdAt: true },
    }),
    prisma.tokenUsageEvent.findMany({
      where: { userId, isBillable: true },
      orderBy: { createdAt: "asc" },
      select: { tokensTotal: true, createdAt: true },
    }),
  ]);

  const quotas = getPlanTokenQuotas(billing.plan);
  const totalQuota = getTotalQuota(quotas);
  const totalUsed = current.totalTokens;
  const totalRemaining = totalQuota != null ? Math.max(0, totalQuota - totalUsed) : null;

  const dailyMap = new Map<string, { total: number; byCategory: Record<CategoryKey, number> }>();
  for (const event of currentEvents) {
    const key = toDateKey(event.createdAt);
    const row = dailyMap.get(key) ?? { total: 0, byCategory: buildEmptyCategories() };
    row.total += event.tokensTotal;
    row.byCategory[event.category] += event.tokensTotal;
    dailyMap.set(key, row);
  }
  const daily = Array.from(dailyMap.entries()).map(([date, value]) => ({
    date,
    totalTokens: value.total,
    byCategory: value.byCategory,
  }));

  const firstPaidAt = firstSucceededPayment
    ? (firstSucceededPayment.paidAt ?? firstSucceededPayment.createdAt)
    : null;
  let freeTokens = 0;
  let paidTokens = 0;
  for (const event of allBillableEvents) {
    if (firstPaidAt && event.createdAt >= firstPaidAt) {
      paidTokens += event.tokensTotal;
    } else {
      freeTokens += event.tokensTotal;
    }
  }

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
    daily,
    freeVsPaid: {
      freeTokens,
      paidTokens,
      firstPaidAt,
    },
  });
}
