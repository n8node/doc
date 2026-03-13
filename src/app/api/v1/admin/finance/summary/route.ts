import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/finance/settings";
import { getBlendedRateRubPerUsd, getWorkingRateRubPerUsd } from "@/lib/finance/blended-rate";
import {
  getActiveFixedExpensesCents,
  getVariableStorageExpensesCents,
  getTotalStorageBytes,
} from "@/lib/finance/expenses";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthParam = request.nextUrl.searchParams.get("month");
  const refDate = monthParam ? new Date(monthParam + "-01") : new Date();
  if (isNaN(refDate.getTime())) {
    return NextResponse.json({ error: "Invalid month format (YYYY-MM)" }, { status: 400 });
  }

  const [
    batches,
    settings,
    blendedRate,
    workingRate,
    monthlyFixedCents,
    totalStorageBytes,
    variableResult,
  ] = await Promise.all([
    prisma.openRouterTopupBatch.findMany({
      where: { usdRemaining: { gt: 0 } },
      orderBy: { toppedAt: "asc" },
    }),
    getFinanceSettings(),
    getBlendedRateRubPerUsd(),
    getWorkingRateRubPerUsd(),
    getActiveFixedExpensesCents(refDate),
    getTotalStorageBytes(),
    getTotalStorageBytes().then((b) => getVariableStorageExpensesCents(b, refDate)),
  ]);

  const totalUsdRemaining = batches.reduce((s, b) => s + b.usdRemaining, 0);
  const storageGb = totalStorageBytes / (1024 * 1024 * 1024);

  return NextResponse.json({
    blendedRateRubPerUsd: blendedRate,
    workingRateRubPerUsd: workingRate,
    totalUsdRemaining,
    batchesCount: batches.length,
    monthlyFixedCents,
    monthlyVariableCents: variableResult.totalCents,
    totalMonthlyExpensesCents: monthlyFixedCents + variableResult.totalCents,
    totalStorageBytes,
    totalStorageGb: Math.round(storageGb * 100) / 100,
    variableExpenseItems: variableResult.items,
    refMonth: `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`,
    settings: {
      taxRatePct: settings.taxRatePct,
      paymentCommissionPct: settings.paymentCommissionPct,
      paymentCommissionPayer: settings.paymentCommissionPayer,
      fxBufferPct: settings.fxBufferPct,
    },
  });
}
