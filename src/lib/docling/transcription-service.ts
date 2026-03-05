import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "../s3-config";
import { createS3Client } from "../s3";
import { getDoclingClient } from "./client";
import { prisma } from "../prisma";
import type { ProcessingStatus } from "./types";

const TRANSCRIBABLE_MIMES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "video/mp4",
  "video/x-msvideo",
  "video/avi",
  "video/quicktime",
  "video/x-m4v",
]);

export function isTranscribable(mimeType: string): boolean {
  return TRANSCRIBABLE_MIMES.has(mimeType);
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

export interface TranscriptionResult {
  fileId: string;
  text: string;
  contentHash: string;
  format: string;
  processedAt: Date;
}

export async function transcribeFile(
  fileId: string,
  s3Key: string,
  filename: string,
  mimeType: string,
  userId: string,
  durationMinutes: number,
): Promise<TranscriptionResult> {
  const task = await prisma.aiTask.create({
    data: {
      type: "TRANSCRIPTION",
      status: "processing",
      userId,
      fileId,
      input: { action: "transcribe", filename, mimeType },
    },
  });

  try {
    const buffer = await downloadFileFromS3(s3Key);
    const docling = getDoclingClient();
    const result = await docling.transcribeFromBuffer(buffer, filename);

    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        output: {
          textLength: result.text.length,
          contentHash: result.content_hash,
          format: result.format,
          minutesUsed: durationMinutes,
        },
        completedAt: new Date(),
      },
    });

    const fileRow = await prisma.file.findUnique({
      where: { id: fileId },
      select: { aiMetadata: true },
    });
    const existing = fileRow?.aiMetadata as Record<string, unknown> | null;
    const baseMetadata = existing && typeof existing === "object" ? existing : {};

    await prisma.file.update({
      where: { id: fileId },
      data: {
        aiMetadata: {
          ...baseMetadata,
          transcriptText: result.text,
          transcriptContentHash: result.content_hash,
          transcriptFormat: result.format,
          transcriptProcessedAt: new Date().toISOString(),
        },
      },
    });

    return {
      fileId,
      text: result.text,
      contentHash: result.content_hash,
      format: result.format,
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

export async function getTranscriptionStatus(
  fileId: string,
): Promise<{ status: ProcessingStatus; error?: string } | null> {
  const task = await prisma.aiTask.findFirst({
    where: { fileId, type: "TRANSCRIPTION" },
    orderBy: { createdAt: "desc" },
    select: { status: true, error: true },
  });
  if (!task) return null;
  return { status: task.status as ProcessingStatus, error: task.error ?? undefined };
}
