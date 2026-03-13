import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/finance/settings";
import { getBlendedRateRubPerUsd, getWorkingRateRubPerUsd } from "@/lib/finance/blended-rate";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [batches, expenses, settings, blendedRate, workingRate] = await Promise.all([
    prisma.openRouterTopupBatch.findMany({
      where: { usdRemaining: { gt: 0 } },
      orderBy: { toppedAt: "asc" },
    }),
    prisma.platformExpense.findMany({
      where: { type: "fixed_monthly" },
      orderBy: { sinceAt: "desc" },
      take: 50,
    }),
    getFinanceSettings(),
    getBlendedRateRubPerUsd(),
    getWorkingRateRubPerUsd(),
  ]);

  const totalUsdRemaining = batches.reduce((s, b) => s + b.usdRemaining, 0);
  const monthlyFixedCents = expenses.reduce((s, e) => s + e.amountCents, 0);

  return NextResponse.json({
    blendedRateRubPerUsd: blendedRate,
    workingRateRubPerUsd: workingRate,
    totalUsdRemaining,
    batchesCount: batches.length,
    monthlyFixedCents,
    settings: {
      taxRatePct: settings.taxRatePct,
      paymentCommissionPct: settings.paymentCommissionPct,
      paymentCommissionPayer: settings.paymentCommissionPayer,
      fxBufferPct: settings.fxBufferPct,
    },
  });
}
