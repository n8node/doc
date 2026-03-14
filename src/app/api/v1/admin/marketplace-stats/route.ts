import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getBlendedRateRubPerUsd } from "@/lib/finance/blended-rate";
import { fetchOpenRouterActivity } from "@/lib/marketplace/openrouter-activity";

/**
 * GET /api/v1/admin/marketplace-stats
 * Статистика маркетплейса: выручка, расходы OpenRouter, заработок платформы.
 * Query: dateFrom=YYYY-MM-DD, dateTo=YYYY-MM-DD (макс. 31 день)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  let dateFrom = searchParams.get("dateFrom");
  let dateTo = searchParams.get("dateTo");
  const month = searchParams.get("month"); // YYYY-MM

  const now = new Date();
  if (month) {
    const m = month.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mon = parseInt(m[2], 10);
      dateFrom = `${m[1]}-${m[2]}-01`;
      const lastDay = new Date(y, mon, 0);
      dateTo = `${m[1]}-${m[2]}-${String(lastDay.getDate()).padStart(2, "0")}`;
    }
  }
  if (!dateFrom) {
    const d = new Date(now);
    d.setDate(1);
    dateFrom = d.toISOString().slice(0, 10);
  }
  if (!dateTo) {
    dateTo = now.toISOString().slice(0, 10);
  }

  const fromDate = new Date(dateFrom + "T00:00:00.000Z");
  const toDate = new Date(dateTo + "T23:59:59.999Z");
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }
  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daysDiff > 31) {
    return NextResponse.json(
      { error: "Максимум 31 день. Уменьшите диапазон или используйте month=YYYY-MM" },
      { status: 400 }
    );
  }

  const [revenueAgg, eventsWithMeta, blendedRate, activityByDay] = await Promise.all([
    prisma.marketplaceUsageEvent.aggregate({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      _sum: { costCents: true },
      _count: true,
    }),
    prisma.marketplaceUsageEvent.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      select: { metadata: true },
    }),
    getBlendedRateRubPerUsd(),
    fetchActivityForRange(dateFrom, dateTo),
  ]);

  const revenueCents = revenueAgg._sum.costCents ?? 0;
  const revenueRub = revenueCents / 100;
  const requestsCount = revenueAgg._count;

  let openRouterCostUsdFromDb = 0;
  for (const e of eventsWithMeta) {
    const meta = e.metadata as Record<string, unknown> | null;
    const costUsd = meta?.costUsd;
    if (typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd >= 0) {
      openRouterCostUsdFromDb += costUsd;
    }
  }

  const openRouterUsageUsdFromApi = activityByDay.totalUsageUsd;
  const openRouterCostUsd = openRouterCostUsdFromDb > 0 ? openRouterCostUsdFromDb : openRouterUsageUsdFromApi;
  const openRouterCostRub =
    blendedRate != null && openRouterCostUsd > 0 ? openRouterCostUsd * blendedRate : null;
  const platformEarningsRub =
    openRouterCostRub != null ? revenueRub - openRouterCostRub : revenueRub;

  return NextResponse.json({
    dateFrom,
    dateTo,
    revenueCents,
    revenueRub,
    requestsCount,
    openRouterCostUsdFromDb,
    openRouterUsageUsdFromApi,
    openRouterCostUsd,
    openRouterCostRub,
    blendedRateRubPerUsd: blendedRate,
    platformEarningsRub,
    activityError: activityByDay.error ?? null,
  });
}

async function fetchActivityForRange(
  dateFrom: string,
  dateTo: string
): Promise<{ totalUsageUsd: number; error?: string }> {
  const dates: string[] = [];
  const from = new Date(dateFrom + "T00:00:00Z");
  const to = new Date(dateTo + "T00:00:00Z");
  const current = new Date(from);
  while (current <= to) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  let totalUsageUsd = 0;
  for (const date of dates) {
    const res = await fetchOpenRouterActivity({ date });
    if (res?.data) {
      for (const item of res.data) {
        totalUsageUsd += item.usage ?? 0;
      }
    }
  }

  return { totalUsageUsd };
}
