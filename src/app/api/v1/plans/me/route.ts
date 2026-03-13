import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { calculateFreePlanTimer, getUserPlan } from "@/lib/plan-service";
import { prisma } from "@/lib/prisma";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import { getTranscriptionMinutesUsedThisMonth } from "@/lib/ai/transcription-usage";
import { getAnalysisDocumentsUsedThisMonth } from "@/lib/ai/analysis-documents-usage";
import {
  getPlanTokenQuotas,
  getTokenUsageSummary,
  getTotalQuota,
  getUserBillingContext,
} from "@/lib/ai/token-usage";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req, { allowExpiredFreePlan: true });
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(userId);
  if (!plan)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const embeddingTokensUsedThisMonth =
    plan.embeddingTokensQuota != null
      ? await getEmbeddingTokensUsedThisMonth(userId)
      : undefined;

  const transcriptionMinutesUsedThisMonth =
    plan.transcriptionMinutesQuota != null
      ? await getTranscriptionMinutesUsedThisMonth(userId)
      : undefined;

  const aiAnalysisDocumentsUsedThisMonth =
    plan.aiAnalysisDocumentsQuota != null
      ? await getAnalysisDocumentsUsedThisMonth(userId)
      : undefined;

  const billing = await getUserBillingContext(userId);
  const cycleUsage = billing
    ? await getTokenUsageSummary(userId, { since: billing.cycleStart })
    : null;
  const quotas = getPlanTokenQuotas(plan);
  const totalQuota = getTotalQuota(quotas);
  const totalUsed = cycleUsage
    ? (cycleUsage.byCategory.CHAT_DOCUMENT ?? 0) +
      (cycleUsage.byCategory.SEARCH ?? 0) +
      (cycleUsage.byCategory.EMBEDDING ?? 0)
    : 0;
  const totalRemaining = totalQuota != null ? Math.max(0, totalQuota - totalUsed) : null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const freePlanDurationDays =
    typeof plan.freePlanDurationDays === "number" ? plan.freePlanDurationDays : null;
  const isFreePlan = plan.isFree === true;

  let freePlanTimer: {
    durationDays: number;
    expiresAt: string;
    remainingDays: number;
    remainingMs: number;
    isExpired: boolean;
  } | null = null;

  if (isFreePlan && freePlanDurationDays != null && user?.createdAt) {
    const timer = calculateFreePlanTimer({
      startedAt: user.createdAt,
      durationDays: freePlanDurationDays,
    });
    freePlanTimer = {
      durationDays: freePlanDurationDays,
      expiresAt: timer.expiresAt.toISOString(),
      remainingDays: timer.remainingDays,
      remainingMs: timer.remainingMs,
      isExpired: timer.isExpired,
    };
  }

  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
    maxFileSize: Number(plan.maxFileSize),
    embeddingTokensUsedThisMonth,
    transcriptionMinutesUsedThisMonth,
    aiAnalysisDocumentsUsedThisMonth,
    tokenQuotas: quotas,
    tokenUsageCurrentCycle: cycleUsage?.byCategory,
    tokenUsageTotalCurrentCycle: totalUsed,
    tokenQuotaTotal: totalQuota,
    tokenRemainingTotal: totalRemaining,
    billingCycleStart: billing?.cycleStart ?? null,
    billingCycleEnd: billing?.cycleEnd ?? null,
    billingAnchorType: billing?.anchorType ?? null,
    freePlanTimer,
  });
}
