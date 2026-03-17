import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const MAX_ALLOWED_FILE_SIZE = BigInt(5 * 1024 * 1024 * 1024); // 5 GB

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      storageQuota: Number(p.storageQuota),
      maxFileSize: Number(p.maxFileSize),
      embeddingTokensQuota: p.embeddingTokensQuota,
      chatTokensQuota: p.chatTokensQuota,
      searchTokensQuota: p.searchTokensQuota,
      aiAnalysisDocumentsQuota: p.aiAnalysisDocumentsQuota,
      ragDocumentsQuota: p.ragDocumentsQuota,
      freePlanDurationDays: p.freePlanDurationDays,
      usersCount: p._count.users,
      _count: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }
  if (!storageQuota || Number(storageQuota) <= 0) {
    return NextResponse.json({ error: "Квота хранилища обязательна" }, { status: 400 });
  }

  const existing = await prisma.plan.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Тариф с таким названием уже существует" }, { status: 409 });
  }

  let fileSizeValue = BigInt(maxFileSize || 512 * 1024 * 1024);
  if (fileSizeValue > MAX_ALLOWED_FILE_SIZE) fileSizeValue = MAX_ALLOWED_FILE_SIZE;

  const lastPlan = await prisma.plan.findFirst({ orderBy: { sortOrder: "desc" } });
  const nextOrder = (lastPlan?.sortOrder ?? -1) + 1;

  if (isPopular) {
    await prisma.plan.updateMany({ where: { isPopular: true }, data: { isPopular: false } });
  }

  const tokensQuota =
    embeddingTokensQuota === undefined || embeddingTokensQuota === null || embeddingTokensQuota === ""
      ? null
      : Math.max(0, parseInt(String(embeddingTokensQuota), 10) || 0) || null;

  const analysisDocsQuota =
    aiAnalysisDocumentsQuota === undefined || aiAnalysisDocumentsQuota === null || aiAnalysisDocumentsQuota === ""
      ? null
      : Math.max(0, parseInt(String(aiAnalysisDocumentsQuota), 10) || 0) || null;

  const transQuota =
    transcriptionMinutesQuota === undefined || transcriptionMinutesQuota === null || transcriptionMinutesQuota === ""
      ? null
      : Math.max(0, parseInt(String(transcriptionMinutesQuota), 10) || 0) || null;
  const maxVideoMin = Math.max(1, parseInt(String(maxTranscriptionVideoMinutes), 10) || 60);
  const maxAudioMin = Math.max(1, parseInt(String(maxTranscriptionAudioMinutes), 10) || 120);

  const plan = await prisma.plan.create({
    data: {
      name: name.trim(),
      isFree: !!isFree,
      storageQuota: BigInt(storageQuota),
      maxFileSize: fileSizeValue,
      trashRetentionDays: typeof trashRetentionDays === "number" ? trashRetentionDays : 0,
      embeddingTokensQuota: tokensQuota,
      chatTokensQuota:
        chatTokensQuota === undefined || chatTokensQuota === null || chatTokensQuota === ""
          ? null
          : Math.max(0, parseInt(String(chatTokensQuota), 10) || 0) || null,
      searchTokensQuota:
        searchTokensQuota === undefined || searchTokensQuota === null || searchTokensQuota === ""
          ? null
          : Math.max(0, parseInt(String(searchTokensQuota), 10) || 0) || null,
      imageGenerationCreditsQuota:
        imageGenerationCreditsQuota === undefined || imageGenerationCreditsQuota === null || imageGenerationCreditsQuota === ""
          ? null
          : Math.max(0, parseInt(String(imageGenerationCreditsQuota), 10) || 0) || null,
      aiAnalysisDocumentsQuota: analysisDocsQuota,
      ragDocumentsQuota:
        ragDocumentsQuota === undefined || ragDocumentsQuota === null || ragDocumentsQuota === ""
          ? null
          : Math.max(0, parseInt(String(ragDocumentsQuota), 10) || 0) || null,
      freePlanDurationDays:
        freePlanDurationDays === undefined || freePlanDurationDays === null || freePlanDurationDays === ""
          ? null
          : Math.max(1, parseInt(String(freePlanDurationDays), 10) || 1),
      transcriptionMinutesQuota: transQuota,
      maxTranscriptionVideoMinutes: maxVideoMin,
      maxTranscriptionAudioMinutes: maxAudioMin,
      transcriptionProviderId: transcriptionProviderId || null,
      features: features ?? {},
      priceMonthly: priceMonthly ?? null,
      priceYearly: priceYearly ?? null,
      sortOrder: nextOrder,
      isPopular: !!isPopular,
    },
  });

  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
    maxFileSize: Number(plan.maxFileSize),
  });
}
