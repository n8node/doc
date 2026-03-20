import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  processDocument,
  isProcessable,
} from "@/lib/docling/processing-service";
import { isTranscribable } from "@/lib/docling/transcription-service";
import { runEmbeddingPipeline } from "@/lib/ai/embedding-pipeline";
import { createNotificationIfEnabled } from "@/lib/notification-service";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";
import { resolveEmbeddingConfig } from "@/lib/ai/embedding-config";
import type { ResolvedEmbeddingConfig } from "@/lib/ai/embedding-config";

function hasTranscriptText(aiMetadata: unknown): boolean {
  if (!aiMetadata || typeof aiMetadata !== "object") return false;
  const meta = aiMetadata as { transcriptText?: string };
  return typeof meta.transcriptText === "string" && meta.transcriptText.trim().length > 0;
}

export interface VectorizeJobInput {
  collectionId: string;
  userId: string;
  skipFirst?: number;
}

interface FileResult {
  fileId: string;
  fileName: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export interface VectorizeJobProgress {
  processed: number;
  total: number;
  processableCount: number;
  processableProcessed: number;
  currentFileName: string;
  succeeded: number;
  failed: number;
  skippedFiles: Array<{ fileName: string; reason: string }>;
  results: FileResult[];
  errors: Array<{ fileName: string; error: string }>;
  stage: "processing" | "done";
}

async function resolveEmbeddingConfigForUser(
  collectionEmbeddingConfig: unknown,
  userId: string,
): Promise<ResolvedEmbeddingConfig> {
  const [userAiConfig, user] = await Promise.all([
    prisma.userAiConfig.findUnique({
      where: { userId, isActive: true },
      select: { embeddingConfig: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
  ]);
  const userConfigRaw =
    userAiConfig?.embeddingConfig ??
    (user?.preferences as Record<string, unknown> | null)?.embeddingConfig ??
    null;
  return resolveEmbeddingConfig(collectionEmbeddingConfig, userConfigRaw);
}

/**
 * Background vectorization job.
 * Creates/updates AiTask record with progress in the `output` JSON field.
 * Continues processing on file errors (auto-skip).
 */
export async function processVectorizeJob(taskId: string): Promise<void> {
  const task = await prisma.aiTask.findUnique({ where: { id: taskId } });
  if (!task) return;

  const input = task.input as unknown as VectorizeJobInput;
  const { collectionId, userId, skipFirst = 0 } = input;

  await prisma.aiTask.update({
    where: { id: taskId },
    data: { status: "processing", startedAt: new Date() },
  });

  try {
    const collection = await prisma.vectorCollection.findFirst({
      where: { id: collectionId, userId },
      include: { files: { include: { file: true } } },
    });

    if (!collection) {
      await prisma.aiTask.update({
        where: { id: taskId },
        data: {
          status: "failed",
          error: "Коллекция не найдена",
          completedAt: new Date(),
        },
      });
      return;
    }

    const embeddingConfig = await resolveEmbeddingConfigForUser(
      collection.embeddingConfig,
      userId,
    );

    const allFiles = collection.files;
    const total = allFiles.length;
    const isVectorizable = (f: (typeof allFiles)[0]) =>
      isProcessable(f.file.mimeType, f.file.name) ||
      (isTranscribable(f.file.mimeType) && hasTranscriptText(f.file.aiMetadata));
    const processableFiles = allFiles.filter(isVectorizable);
    const processableCount = processableFiles.length;

    const skippedProcessable = allFiles
      .slice(0, skipFirst)
      .filter(isVectorizable).length;
    let processableProcessed = skippedProcessable;

    const results: FileResult[] = [];
    const skippedFiles: Array<{ fileName: string; reason: string }> = [];
    const errors: Array<{ fileName: string; error: string }> = [];
    let succeeded = 0;
    let processed = skipFirst;

    const updateProgress = async (
      currentFileName: string,
      stage: "processing" | "done" = "processing",
    ) => {
      const progress: VectorizeJobProgress = {
        processed,
        total,
        processableCount,
        processableProcessed,
        currentFileName,
        succeeded,
        failed: errors.length,
        skippedFiles,
        results,
        errors,
        stage,
      };
      await prisma.aiTask.update({
        where: { id: taskId },
        data: { output: progress as unknown as Prisma.InputJsonValue },
      });
    };

    let idx = 0;
    for (const item of allFiles) {
      const { file } = item;
      if (idx < skipFirst) {
        idx++;
        continue;
      }
      idx++;

      if (!isVectorizable(item)) {
        const reason = isTranscribable(file.mimeType)
          ? "Сначала транскрибируйте аудиофайл"
          : "Формат не поддерживается для векторизации";
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: false,
          error: reason,
          skipped: true,
        });
        skippedFiles.push({ fileName: file.name, reason });
        processed++;
        await updateProgress(file.name);
        continue;
      }

      if (file.hasEmbedding) {
        processableProcessed++;
        succeeded++;
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: true,
        });
        processed++;
        await updateProgress(file.name);
        continue;
      }

      await updateProgress(file.name);

      try {
        if (isProcessable(file.mimeType, file.name)) {
          await processDocument(
            file.id,
            file.s3Key,
            file.name,
            file.mimeType,
            userId,
            { embeddingConfig },
          );
        } else {
          const meta = file.aiMetadata as { transcriptText?: string; transcriptContentHash?: string } | null;
          const transcriptText = meta?.transcriptText ?? "";
          const contentHash = meta?.transcriptContentHash ?? `transcript-${Date.now()}`;
          const result = await runEmbeddingPipeline(
            file.id,
            transcriptText,
            contentHash,
            userId,
            embeddingConfig,
          );
          if (result.embeddingsCreated > 0) {
            const existingMeta = (file.aiMetadata ?? {}) as Record<string, unknown>;
            await prisma.file.update({
              where: { id: file.id },
              data: {
                aiMetadata: {
                  ...existingMeta,
                  processedAt: new Date().toISOString(),
                },
              },
            });
          }
        }
        processableProcessed++;
        succeeded++;
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: true,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[vectorize-job] Ошибка на файле:", file.name, msg);
        processableProcessed++;
        errors.push({ fileName: file.name, error: msg });
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: false,
          error: msg,
          skipped: false,
        });
        skippedFiles.push({ fileName: file.name, reason: msg });
      }

      processed++;
      await updateProgress(file.name);
    }

    // Notifications
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
          skippedFiles.length === 1
            ? `${skippedFiles[0].fileName} — ${skippedFiles[0].reason}`
            : `${skippedFiles.length} файлов не участвуют в векторной базе «${collection.name}»:\n${skippedList}`,
        payload: {
          collectionId,
          collectionName: collection.name,
          skippedCount: skippedFiles.length,
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
        body: `Обработано ${succeeded} из ${processableCount} файлов в «${collection.name}»`,
        payload: {
          collectionId,
          collectionName: collection.name,
          succeeded,
          total: processableCount,
        },
      });
      try {
        await sendUserTelegramNotify(userId, "vectorize_done", {
          collectionName: collection.name,
          succeeded,
          total: processableCount,
        });
      } catch {
        // ignore
      }
    }

    await updateProgress(results[results.length - 1]?.fileName ?? "", "done");
    await prisma.aiTask.update({
      where: { id: taskId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[vectorize-job] Fatal error:", msg);
    await prisma.aiTask.update({
      where: { id: taskId },
      data: { status: "failed", error: msg, completedAt: new Date() },
    });
  }
}
