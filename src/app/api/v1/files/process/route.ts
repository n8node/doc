import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  processDocument,
  getProcessingStatus,
  isProcessable,
} from "@/lib/docling/processing-service";
import { createNotificationIfEnabled, createQuota80WarningIfNeeded } from "@/lib/notification-service";
import { estimateAnalysisTime } from "@/lib/docling/analysis-estimate";
import { getDoclingClient } from "@/lib/docling/client";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import { userUsesOwnKey } from "@/lib/ai/get-provider-for-user";
import { getAnalysisDocumentsUsedThisMonth } from "@/lib/ai/analysis-documents-usage";
import { getUserPlan } from "@/lib/plan-service";

/**
 * POST /api/files/process — start document processing
 * Body: { fileId: string } or { fileIds: string[] }
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const fileIds: string[] = body.fileIds
    ? body.fileIds
    : body.fileId
      ? [body.fileId]
      : [];

  if (fileIds.length === 0) {
    return NextResponse.json({ error: "fileId or fileIds is required" }, { status: 400 });
  }

  const docling = getDoclingClient();
  const available = await docling.isAvailable();
  if (!available) {
    return NextResponse.json(
      { error: "Сервис обработки документов недоступен (QoQon)" },
      { status: 503 },
    );
  }

  const docAnalysisError = await checkDocumentAnalysisAccess(userId, fileIds.length);
  if (docAnalysisError) return docAnalysisError;

  const usesOwnKey = await userUsesOwnKey(userId);
  if (!usesOwnKey) {
    const quotaError = await checkEmbeddingQuota(userId);
    if (quotaError) return quotaError;
  }

  if (fileIds.length === 1) {
    return processSingle(fileIds[0], userId);
  }

  return processBulk(fileIds, userId);
}

async function checkDocumentAnalysisAccess(
  userId: string,
  documentsToProcess: number,
): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId);
  if (!plan) return null;

  const features = plan.features ?? {};
  if (features.document_analysis !== true) {
    return NextResponse.json(
      {
        error: "AI-анализ документов недоступен по вашему тарифу. Обновите тариф для доступа.",
        code: "DOCUMENT_ANALYSIS_DISABLED",
      },
      { status: 403 },
    );
  }

  const quota = plan.aiAnalysisDocumentsQuota ?? null;
  if (quota == null) return null;

  const used = await getAnalysisDocumentsUsedThisMonth(userId);
  const afterProcess = used + documentsToProcess;
  if (afterProcess > quota) {
    return NextResponse.json(
      {
        error:
          documentsToProcess === 1
            ? `Лимит документов AI-анализа по вашему тарифу исчерпан (${used}/${quota} в этом месяце). Обновите тариф или дождитесь следующего месяца.`
            : `Недостаточно лимита документов AI-анализа. Использовано ${used}/${quota}. Осталось ${Math.max(0, quota - used)}.`,
        code: "AI_ANALYSIS_DOCUMENTS_QUOTA_EXCEEDED",
        used,
        quota,
      },
      { status: 403 },
    );
  }
  return null;
}

async function checkEmbeddingQuota(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, plan: { select: { embeddingTokensQuota: true } } },
  });
  const quota = user?.plan?.embeddingTokensQuota ?? null;
  if (quota == null) return null;

  const used = await getEmbeddingTokensUsedThisMonth(userId);
  createQuota80WarningIfNeeded(userId, used, quota, "embedding").catch(() => {});
  if (used >= quota) {
    createNotificationIfEnabled({
      userId,
      type: "QUOTA",
      category: "warning",
      title: "Лимит анализа исчерпан",
      body: "Токенов на анализ документов по тарифу недостаточно. Обновите тариф или дождитесь следующего месяца.",
      payload: { used, quota },
    }).catch(() => {});
    return NextResponse.json(
      {
        error: "Лимит токенов на анализ документов по вашему тарифу исчерпан. Обновите тариф или дождитесь следующего месяца.",
        code: "EMBEDDING_QUOTA_EXCEEDED",
        used,
        quota,
      },
      { status: 403 },
    );
  }
  return null;
}

async function processSingle(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!isProcessable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается` },
      { status: 415 },
    );
  }

  const existing = await getProcessingStatus(fileId);
  if (existing?.status === "processing") {
    return NextResponse.json(
      { error: "Файл уже обрабатывается", status: existing.status },
      { status: 409 },
    );
  }

  processDocument(
    file.id, file.s3Key, file.name, file.mimeType, userId,
  ).catch((err) => {
    console.error("[process] Background failed:", err);
  });

  const estimate = estimateAnalysisTime(file.size, file.mimeType);

  return NextResponse.json(
    {
      status: "processing",
      fileId: file.id,
      message: "Обработка запущена",
      estimatedProcessingSeconds: estimate.estimatedProcessingSeconds,
      estimatedProcessingMinutes: estimate.estimatedProcessingMinutes,
    },
    { status: 202 },
  );
}

async function processBulk(fileIds: string[], userId: string) {
  const files = await prisma.file.findMany({
    where: { id: { in: fileIds }, userId, deletedAt: null },
  });

  const results: Array<{
    fileId: string;
    fileName: string;
    success: boolean;
    error?: string;
    textLength?: number;
    numPages?: number;
  }> = [];

  for (const file of files) {
    if (!isProcessable(file.mimeType)) {
      results.push({ fileId: file.id, fileName: file.name, success: false, error: "Формат не поддерживается" });
      continue;
    }
    try {
      const result = await processDocument(
        file.id, file.s3Key, file.name, file.mimeType, userId,
      );
      results.push({
        fileId: file.id,
        fileName: file.name,
        success: true,
        textLength: result.text.length,
        numPages: result.numPages ?? undefined,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ fileId: file.id, fileName: file.name, success: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return NextResponse.json({
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  });
}

/**
 * GET /api/files/process?fileId=xxx — check processing status
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId },
    select: { id: true, aiMetadata: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const status = await getProcessingStatus(fileId);
  return NextResponse.json({
    fileId,
    status: status?.status ?? "none",
    error: status?.error,
    metadata: file.aiMetadata,
  });
}
