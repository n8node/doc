import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "../s3-config";
import { createS3Client } from "../s3";
import { getDoclingClient } from "./client";
import { runEmbeddingPipeline } from "../ai/embedding-pipeline";
import { createNotificationIfEnabled } from "../notification-service";
import { prisma } from "../prisma";
import type { DocumentProcessingResult, ProcessingStatus } from "./types";
import type { ResolvedEmbeddingConfig } from "../ai/embedding-config";

const PROCESSABLE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/html",
  "text/plain",
  "text/csv",
  "text/markdown",
  // Изображения — Docling поддерживает OCR
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/bmp",
]);

export function isProcessable(mimeType: string): boolean {
  return PROCESSABLE_MIMES.has(mimeType);
}

async function downloadFileFromS3(s3Key: string): Promise<Buffer> {
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: s3Key }),
  );
  if (!response.Body) throw new Error("Empty S3 response body");
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export interface ProcessDocumentOptions {
  embeddingConfig?: ResolvedEmbeddingConfig | null;
}

export async function processDocument(
  fileId: string,
  s3Key: string,
  filename: string,
  mimeType: string,
  userId: string,
  options?: ProcessDocumentOptions,
): Promise<DocumentProcessingResult> {
  const task = await prisma.aiTask.create({
    data: {
      type: "ANALYSIS",
      status: "processing",
      userId,
      fileId,
      input: { action: "extract", filename, mimeType },
    },
  });

  try {
    const buffer = await downloadFileFromS3(s3Key);
    const docling = getDoclingClient();
    const result = await docling.extractFromBuffer(buffer, filename, "markdown");

    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        output: {
          textLength: result.text.length,
          tablesCount: result.tables.length,
          contentHash: result.content_hash,
          numPages: result.num_pages,
        },
        completedAt: new Date(),
      },
    });

    await prisma.file.update({
      where: { id: fileId },
      data: {
        aiMetadata: {
          extractedText: result.text.slice(0, 50_000),
          tablesCount: result.tables.length,
          contentHash: result.content_hash,
          numPages: result.num_pages,
          processedAt: new Date().toISOString(),
        },
      },
    });

    try {
      await runEmbeddingPipeline(
        fileId,
        result.text,
        result.content_hash,
        userId,
        options?.embeddingConfig,
      );
    } catch (embErr) {
      console.error(`[Docling] Embedding pipeline failed for ${fileId}:`, embErr);
    }

    createNotificationIfEnabled({
      userId,
      type: "AI_TASK",
      category: "success",
      title: "Анализ завершён",
      body: `Документ обработан: ${result.num_pages ? `${result.num_pages} стр.` : ""}`.trim() || undefined,
      payload: { fileId, filename },
    }).catch(() => {});

    return {
      fileId,
      text: result.text,
      tables: result.tables,
      contentHash: result.content_hash,
      numPages: result.num_pages,
      processedAt: new Date(),
    };
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    const errMsg = error instanceof Error ? error.message : String(error);
    createNotificationIfEnabled({
      userId,
      type: "AI_TASK",
      category: "error",
      title: "Анализ не удался",
      body: errMsg.length > 200 ? errMsg.slice(0, 200) + "…" : errMsg,
      payload: { fileId, filename },
    }).catch(() => {});
    throw error;
  }
}

export async function getProcessingStatus(
  fileId: string,
): Promise<{ status: ProcessingStatus; error?: string } | null> {
  const task = await prisma.aiTask.findFirst({
    where: { fileId, type: "ANALYSIS" },
    orderBy: { createdAt: "desc" },
    select: { status: true, error: true },
  });
  if (!task) return null;
  return { status: task.status as ProcessingStatus, error: task.error ?? undefined };
}
