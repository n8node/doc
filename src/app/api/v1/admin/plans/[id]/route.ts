import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const {
    name, isFree, storageQuota, maxFileSize, trashRetentionDays, embeddingTokensQuota,
    chatTokensQuota, searchTokensQuota, imageGenerationCreditsQuota,
    aiAnalysisDocumentsQuota,
    ragDocumentsQuota,
    freePlanDurationDays,
    transcriptionMinutesQuota, maxTranscriptionVideoMinutes, maxTranscriptionAudioMinutes, transcriptionProviderId,
    features, priceMonthly, priceYearly, isPopular,
  } = body;
  const data: Record<string, unknown> = {};
  if (name != null) data.name = name;
  if (isFree != null) data.isFree = !!isFree;
  if (storageQuota != null) data.storageQuota = BigInt(storageQuota);
  if (maxFileSize != null) {
    const MAX_ALLOWED = BigInt(5 * 1024 * 1024 * 1024);
    const value = BigInt(maxFileSize);
    data.maxFileSize = value > MAX_ALLOWED ? MAX_ALLOWED : value;
  }
  if (trashRetentionDays != null) data.trashRetentionDays = trashRetentionDays;
  if (embeddingTokensQuota !== undefined) {
    data.embeddingTokensQuota =
      embeddingTokensQuota === null || embeddingTokensQuota === ""
        ? null
        : Math.max(0, parseInt(String(embeddingTokensQuota), 10) || 0) || null;
  }
  if (chatTokensQuota !== undefined) {
    data.chatTokensQuota =
      chatTokensQuota === null || chatTokensQuota === ""
        ? null
        : Math.max(0, parseInt(String(chatTokensQuota), 10) || 0) || null;
  }
  if (searchTokensQuota !== undefined) {
    data.searchTokensQuota =
      searchTokensQuota === null || searchTokensQuota === ""
        ? null
        : Math.max(0, parseInt(String(searchTokensQuota), 10) || 0) || null;
  }
  if (imageGenerationCreditsQuota !== undefined) {
    data.imageGenerationCreditsQuota =
      imageGenerationCreditsQuota === null || imageGenerationCreditsQuota === ""
        ? null
        : Math.max(0, parseInt(String(imageGenerationCreditsQuota), 10) || 0) || null;
  }
  if (aiAnalysisDocumentsQuota !== undefined) {
    data.aiAnalysisDocumentsQuota =
      aiAnalysisDocumentsQuota === null || aiAnalysisDocumentsQuota === ""
        ? null
        : Math.max(0, parseInt(String(aiAnalysisDocumentsQuota), 10) || 0) || null;
  }
  if (ragDocumentsQuota !== undefined) {
    data.ragDocumentsQuota =
      ragDocumentsQuota === null || ragDocumentsQuota === ""
        ? null
        : Math.max(0, parseInt(String(ragDocumentsQuota), 10) || 0) || null;
  }
  if (freePlanDurationDays !== undefined) {
    data.freePlanDurationDays =
      freePlanDurationDays === null || freePlanDurationDays === ""
        ? null
        : Math.max(1, parseInt(String(freePlanDurationDays), 10) || 1);
  }
  if (transcriptionMinutesQuota !== undefined) {
    data.transcriptionMinutesQuota =
      transcriptionMinutesQuota === null || transcriptionMinutesQuota === ""
        ? null
        : Math.max(0, parseInt(String(transcriptionMinutesQuota), 10) || 0) || null;
  }
  if (maxTranscriptionVideoMinutes != null) {
    data.maxTranscriptionVideoMinutes = Math.max(1, parseInt(String(maxTranscriptionVideoMinutes), 10) || 60);
  }
  if (maxTranscriptionAudioMinutes != null) {
    data.maxTranscriptionAudioMinutes = Math.max(1, parseInt(String(maxTranscriptionAudioMinutes), 10) || 120);
  }
  if (transcriptionProviderId !== undefined) {
    data.transcriptionProviderId = transcriptionProviderId || null;
  }
  if (features != null) data.features = features;
  if (priceMonthly != null) data.priceMonthly = priceMonthly;
  if (priceYearly != null) data.priceYearly = priceYearly;
  if (isPopular != null) {
    data.isPopular = !!isPopular;
    if (isPopular) {
      await prisma.plan.updateMany({ where: { isPopular: true, id: { not: id } }, data: { isPopular: false } });
    }
  }
  const plan = await prisma.plan.update({ where: { id }, data });
  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
    maxFileSize: Number(plan.maxFileSize),
    embeddingTokensQuota: plan.embeddingTokensQuota,
    chatTokensQuota: plan.chatTokensQuota,
    searchTokensQuota: plan.searchTokensQuota,
    imageGenerationCreditsQuota: plan.imageGenerationCreditsQuota,
    aiAnalysisDocumentsQuota: plan.aiAnalysisDocumentsQuota,
    ragDocumentsQuota: plan.ragDocumentsQuota,
    freePlanDurationDays: plan.freePlanDurationDays,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const usersOnPlan = await prisma.user.count({ where: { planId: id } });
  if (usersOnPlan > 0) {
    return NextResponse.json(
      { error: `Нельзя удалить: ${usersOnPlan} пользователей на этом тарифе` },
      { status: 409 }
    );
  }

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
