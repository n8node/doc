import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      isFree: true,
      storageQuota: true,
      maxFileSize: true,
      features: true,
      aiAnalysisDocumentsQuota: true,
      embeddingTokensQuota: true,
      chatTokensQuota: true,
      searchTokensQuota: true,
      transcriptionMinutesQuota: true,
      transcriptionAudioMinutesQuota: true,
      transcriptionVideoMinutesQuota: true,
      maxTranscriptionAudioMinutes: true,
      maxTranscriptionVideoMinutes: true,
      ragDocumentsQuota: true,
      imageGenerationCreditsQuota: true,
      videoGenerationCreditsQuota: true,
      webImportPagesQuota: true,
      freePlanDurationDays: true,
      priceMonthly: true,
      priceYearly: true,
      isPopular: true,
      trashRetentionDays: true,
    },
  });
  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      storageQuota: Number(p.storageQuota),
      maxFileSize: Number(p.maxFileSize),
    })),
  });
}
