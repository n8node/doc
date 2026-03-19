import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { runEmbeddingPipeline } from "@/lib/ai/embedding-pipeline";
import { isTranscribable } from "@/lib/docling/transcription-service";
import { userUsesOwnKey } from "@/lib/ai/get-provider-for-user";
import { getUserPlan } from "@/lib/plan-service";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import { checkDocumentAnalysisAccess } from "@/lib/docling/process-access";
import { createNotificationIfEnabled } from "@/lib/notification-service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/files/[id]/embed-transcript
 * Векторизация транскрипта аудио для чата и RAG.
 * После успешной транскрибации прогоняет transcriptText через embedding pipeline.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true, name: true, mimeType: true, aiMetadata: true },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: "Файл не поддерживает транскрибацию" },
      { status: 400 },
    );
  }

  const metadata = file.aiMetadata as { transcriptText?: string; transcriptContentHash?: string } | null;
  const transcriptText = metadata?.transcriptText;
  const contentHash = metadata?.transcriptContentHash ?? "";

  if (!transcriptText || typeof transcriptText !== "string" || transcriptText.trim().length === 0) {
    return NextResponse.json(
      { error: "Сначала транскрибируйте аудиофайл" },
      { status: 400 },
    );
  }

  const docAnalysisError = await checkDocumentAnalysisAccess(userId, 1);
  if (docAnalysisError) return docAnalysisError;

  const usesOwnKey = await userUsesOwnKey(userId);
  if (!usesOwnKey) {
    const plan = await getUserPlan(userId);
    const quota = plan?.embeddingTokensQuota ?? null;
    if (quota != null) {
      const used = await getEmbeddingTokensUsedThisMonth(userId);
      if (used >= quota) {
        return NextResponse.json(
          {
            error: "Лимит токенов на анализ исчерпан",
            code: "EMBEDDING_QUOTA_EXCEEDED",
            used,
            quota,
          },
          { status: 403 },
        );
      }
    }
  }

  try {
    const result = await runEmbeddingPipeline(
      fileId,
      transcriptText,
      contentHash || `transcript-${Date.now()}`,
      userId,
    );

    if (result.embeddingsCreated > 0) {
      const existingMeta = (file.aiMetadata ?? {}) as Record<string, unknown>;
      await prisma.file.update({
        where: { id: fileId },
        data: {
          aiMetadata: {
            ...existingMeta,
            processedAt: new Date().toISOString(),
          },
        },
      });
    }

    createNotificationIfEnabled({
      userId,
      type: "AI_TASK",
      category: "success",
      title: "Индексация транскрипта готова",
      body: "Теперь можно вести чат по аудио.",
      payload: { fileId, filename: file.name },
    }).catch(() => {});

    return NextResponse.json({
      status: "completed",
      fileId,
      chunksCount: result.chunksCount,
      embeddingsCreated: result.embeddingsCreated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[embed-transcript] Error:", msg);
    return NextResponse.json(
      { error: msg, status: "failed" },
      { status: 500 },
    );
  }
}
