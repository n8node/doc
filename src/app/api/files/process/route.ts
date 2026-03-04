import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  processDocument,
  getProcessingStatus,
  isProcessable,
} from "@/lib/docling/processing-service";
import { getDoclingClient } from "@/lib/docling/client";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";

/**
 * POST /api/files/process — start document processing
 * Body: { fileId: string } or { fileIds: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
      { error: "Сервис обработки документов недоступен (Docling)" },
      { status: 503 },
    );
  }

  const quotaError = await checkEmbeddingQuota(session.user.id);
  if (quotaError) return quotaError;

  if (fileIds.length === 1) {
    return processSingle(fileIds[0], session.user.id);
  }

  return processBulk(fileIds, session.user.id);
}

async function checkEmbeddingQuota(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, plan: { select: { embeddingTokensQuota: true } } },
  });
  const quota = user?.plan?.embeddingTokensQuota ?? null;
  if (quota == null) return null;

  const used = await getEmbeddingTokensUsedThisMonth(userId);
  if (used >= quota) {
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

  return NextResponse.json(
    { status: "processing", fileId: file.id, message: "Обработка запущена" },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId: session.user.id },
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
