import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "../s3-config";
import { createS3Client } from "../s3";
import { getDoclingClient } from "./client";
import { runEmbeddingPipeline } from "../ai/embedding-pipeline";
import { prisma } from "../prisma";
import type { DocumentProcessingResult, ProcessingStatus } from "./types";

const PROCESSABLE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "text/html",
  "text/plain",
  "text/csv",
  "text/markdown",
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

export async function processDocument(
  fileId: string,
  s3Key: string,
  filename: string,
  mimeType: string,
  userId: string,
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
      await runEmbeddingPipeline(fileId, result.text, result.content_hash, userId);
    } catch (embErr) {
      console.error(`[Docling] Embedding pipeline failed for ${fileId}:`, embErr);
    }

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
