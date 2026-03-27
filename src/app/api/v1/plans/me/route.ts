import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { calculateFreePlanTimer, getUserPlan } from "@/lib/plan-service";
import { prisma } from "@/lib/prisma";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import {
  getTranscriptionAudioMinutesUsedThisMonth,
  getTranscriptionMinutesUsedThisMonth,
  getTranscriptionVideoMinutesUsedThisMonth,
} from "@/lib/ai/transcription-usage";
import { isSplitTranscriptionQuotaMode } from "@/lib/ai/transcription-quota";
import { getAnalysisDocumentsUsedThisMonth } from "@/lib/ai/analysis-documents-usage";
import { getWebImportPagesUsedThisMonth } from "@/lib/web-import/web-import-pages-usage";
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

  const splitTx = isSplitTranscriptionQuotaMode({
    transcriptionMinutesQuota: plan.transcriptionMinutesQuota,
    transcriptionAudioMinutesQuota: plan.transcriptionAudioMinutesQuota,
    transcriptionVideoMinutesQuota: plan.transcriptionVideoMinutesQuota,
  });

  let transcriptionMinutesUsedThisMonth: number | undefined;
  let transcriptionAudioMinutesUsedThisMonth: number | undefined;
  let transcriptionVideoMinutesUsedThisMonth: number | undefined;

  if (splitTx) {
    const audioQ =
      plan.transcriptionAudioMinutesQuota ?? plan.transcriptionMinutesQuota;
    const videoQ =
      plan.transcriptionVideoMinutesQuota ?? plan.transcriptionMinutesQuota;
    if (audioQ != null) {
      transcriptionAudioMinutesUsedThisMonth =
        await getTranscriptionAudioMinutesUsedThisMonth(userId);
    }
    if (videoQ != null) {
      transcriptionVideoMinutesUsedThisMonth =
        await getTranscriptionVideoMinutesUsedThisMonth(userId);
    }
  } else if (plan.transcriptionMinutesQuota != null) {
    transcriptionMinutesUsedThisMonth =
      await getTranscriptionMinutesUsedThisMonth(userId);
  }

  const aiAnalysisDocumentsUsedThisMonth =
    plan.aiAnalysisDocumentsQuota != null
      ? await getAnalysisDocumentsUsedThisMonth(userId)
      : undefined;

  const webImportPagesUsedThisMonth =
    plan.features?.web_import === true
      ? await getWebImportPagesUsedThisMonth(userId)
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
    transcriptionAudioMinutesUsedThisMonth,
    transcriptionVideoMinutesUsedThisMonth,
    aiAnalysisDocumentsUsedThisMonth,
    webImportPagesUsedThisMonth,
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
