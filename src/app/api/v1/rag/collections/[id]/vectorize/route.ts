import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  processDocument,
  isProcessable,
} from "@/lib/docling/processing-service";
import { createNotificationIfEnabled } from "@/lib/notification-service";
import { getDoclingClient } from "@/lib/docling/client";
import { checkDocumentAnalysisAccess } from "@/lib/docling/process-access";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import { userUsesOwnKey } from "@/lib/ai/get-provider-for-user";
import { getUserPlan } from "@/lib/plan-service";
import { checkRagMemoryAccess } from "@/lib/rag/access";
import { resolveEmbeddingConfig } from "@/lib/ai/embedding-config";

type Ctx = { params: Promise<{ id: string }> };

function streamLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj) + "\n";
}

/**
 * POST /api/v1/rag/collections/[id]/vectorize — mass vectorization of collection files.
 * Returns NDJSON stream: { type, processed?, total?, remaining?, currentFileName?, succeeded?, failed? }.
 * Skips non-processable files and sends notifications for each skipped file.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;

  const [collection, userAiConfig, user] = await Promise.all([
    prisma.vectorCollection.findFirst({
      where: { id, userId },
      include: {
        files: {
          include: {
            file: true,
          },
        },
      },
    }),
    prisma.userAiConfig.findUnique({
      where: { userId, isActive: true },
      select: { embeddingConfig: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
  ]);

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const userConfigRaw =
    userAiConfig?.embeddingConfig ?? (user?.preferences as Record<string, unknown> | null)?.embeddingConfig ?? null;
  const embeddingConfig = resolveEmbeddingConfig(collection.embeddingConfig, userConfigRaw);

  const docling = getDoclingClient();
  const available = await docling.isAvailable();
  if (!available) {
    return NextResponse.json(
      { error: "Сервис обработки документов недоступен" },
      { status: 503 }
    );
  }

  const processableFiles = collection.files.filter((f) =>
    isProcessable(f.file.mimeType)
  );
  const processableCount = processableFiles.length;
  const docAnalysisError = await checkDocumentAnalysisAccess(
    userId,
    processableCount
  );
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
          { status: 403 }
        );
      }
    }
  }

  const total = collection.files.length;
  let skipFirst = 0;
  try {
    const body = await request.json().catch(() => ({}));
    const v = typeof body?.skipFirst === "number" && body.skipFirst >= 0 ? Math.floor(body.skipFirst) : 0;
    skipFirst = Math.min(v, total);
  } catch {
    /* ignore */
  }

  const skippedProcessable = collection.files
    .slice(0, skipFirst)
    .filter((f) => isProcessable(f.file.mimeType)).length;
  let processableProcessed = skippedProcessable;

  const results: Array<{
    fileId: string;
    fileName: string;
    success: boolean;
    error?: string;
    textLength?: number;
    numPages?: number;
    skipped?: boolean;
  }> = [];
  const skippedFiles: Array<{ fileName: string; reason: string }> = [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          streamLine({
            type: "stage",
            stage: "ready",
            processableCount,
            total,
          })
        )
      );

      let processed = skipFirst;
      let idx = 0;
      for (const { file } of collection.files) {
        if (idx < skipFirst) {
          idx++;
          continue;
        }
        idx++;
        if (!isProcessable(file.mimeType)) {
          results.push({
            fileId: file.id,
            fileName: file.name,
            success: false,
            error: "Формат не поддерживается",
            skipped: true,
          });
          skippedFiles.push({
            fileName: file.name,
            reason: "Формат не поддерживается для векторизации",
          });
          processed++;
          controller.enqueue(
            encoder.encode(
              streamLine({
                type: "progress",
                processed,
                total,
                processableCount,
                processableProcessed,
                remaining: total - processed,
                currentFileName: file.name,
              })
            )
          );
          continue;
        }

        controller.enqueue(
          encoder.encode(
            streamLine({
              type: "processing_file",
              fileName: file.name,
              processed,
              total,
              processableCount,
              processableProcessed,
            })
          )
        );
        try {
          const result = await processDocument(
            file.id,
            file.s3Key,
            file.name,
            file.mimeType,
            userId,
            { embeddingConfig }
          );
          processableProcessed++;
          results.push({
            fileId: file.id,
            fileName: file.name,
            success: true,
            textLength: result.text.length,
            numPages: result.numPages ?? undefined,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error("[vectorize] Ошибка на файле:", file.name, msg);
          processableProcessed++;
          controller.enqueue(
            encoder.encode(
              streamLine({
                type: "file_error",
                fileName: file.name,
                error: msg,
                processed: processed + 1,
                total,
                processableCount,
                processableProcessed,
              })
            )
          );
          results.push({
            fileId: file.id,
            fileName: file.name,
            success: false,
            error: msg,
            skipped: false,
          });
          skippedFiles.push({
            fileName: file.name,
            reason: msg,
          });
        }
        processed++;
        controller.enqueue(
          encoder.encode(
            streamLine({
              type: "progress",
              processed,
              total,
              processableCount,
              processableProcessed,
              remaining: total - processed,
              currentFileName: file.name,
            })
          )
        );
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);

      if (skippedFiles.length > 0) {
        const skippedList = skippedFiles
          .map((s) => `• ${s.fileName}: ${s.reason}`)
          .join("\n");
        await createNotificationIfEnabled({
          userId,
          type: "AI_TASK",
          category: "warning",
          title: "Часть файлов пропущена при векторизации",
          body:
            failed.length === 1
              ? `${skippedFiles[0].fileName} — ${skippedFiles[0].reason}`
              : `${failed.length} файлов не участвуют в векторной базе «${collection.name}»:\n${skippedList}`,
          payload: {
            collectionId: id,
            collectionName: collection.name,
            skippedCount: failed.length,
            skipped: skippedFiles,
          },
        });
      }

      if (succeeded > 0) {
        await createNotificationIfEnabled({
          userId,
          type: "AI_TASK",
          category: "success",
          title: "Векторизация завершена",
          body: `Обработано ${succeeded} из ${results.length} файлов в «${collection.name}»`,
          payload: {
            collectionId: id,
            collectionName: collection.name,
            succeeded,
            total: results.length,
          },
        });
      }

      controller.enqueue(
        encoder.encode(
          streamLine({
            type: "done",
            collectionId: id,
            total: results.length,
            succeeded,
            failed: results.length - succeeded,
          })
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
