import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "../s3-config";
import { createS3Client } from "../s3";
import { getDoclingClient } from "./client";
import { createNotificationIfEnabled } from "../notification-service";
import { prisma } from "../prisma";
import { getTranscriptionProviderForUser } from "../ai/get-transcription-provider";
import { transcribeWithOpenAiWhisper } from "../ai/openai-whisper";
import { transcribeWithOpenRouter } from "../ai/openrouter-transcribe";
import { recordTokenUsageEvent } from "../ai/token-usage";
import type { ProcessingStatus } from "./types";

// REMINDER: Video transcription disabled. API rejects video before reaching here. Restore when ready.
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

export function estimateTranscriptionTokens(durationMinutes: number, textLength = 0): number {
  const byDuration = Math.max(0, Math.ceil(durationMinutes * 750));
  const byText = Math.max(0, Math.ceil(textLength / 4));
  return Math.max(byDuration, byText, 1);
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
    let result: { text: string; content_hash: string; format: string };

    const provider = await getTranscriptionProviderForUser(userId);
    const useOpenAi =
      provider &&
      (provider.name === "openai_whisper" || provider.baseUrl.includes("api.openai.com"));
    const useOpenRouter =
      provider &&
      (provider.name === "openrouter" || provider.baseUrl.includes("openrouter.ai"));

    if (useOpenRouter && provider) {
      const openRouterResult = await transcribeWithOpenRouter(
        buffer,
        filename,
        mimeType,
        provider.apiKey,
        provider.baseUrl,
        provider.modelName,
      );
      result = {
        text: openRouterResult.text,
        content_hash: openRouterResult.contentHash,
        format: openRouterResult.format,
      };
    } else if (useOpenAi && provider) {
      const openAiResult = await transcribeWithOpenAiWhisper(
        buffer,
        filename,
        mimeType,
        provider.apiKey,
        provider.baseUrl,
        provider.modelName,
      );
      result = {
        text: openAiResult.text,
        content_hash: openAiResult.contentHash,
        format: openAiResult.format,
      };
    } else {
      const docling = getDoclingClient();
      const doclingResult = await docling.transcribeFromBuffer(buffer, filename);
      result = {
        text: doclingResult.text,
        content_hash: doclingResult.content_hash,
        format: doclingResult.format,
      };
    }

    const providerKey = useOpenRouter ? "openrouter" : useOpenAi ? "openai_whisper" : "docling";
    const modelDisplay =
      useOpenRouter && provider?.modelName
        ? provider.modelName
        : useOpenAi && provider?.modelName
          ? provider.modelName
          : useOpenAi
            ? "OpenAI"
            : "QoQon";

    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        output: {
          textLength: result.text.length,
          contentHash: result.content_hash,
          format: result.format,
          minutesUsed: durationMinutes,
          provider: providerKey,
          modelName: modelDisplay,
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
          transcriptProvider: providerKey,
        },
      },
    });

    createNotificationIfEnabled({
      userId,
      type: "AI_TASK",
      category: "success",
      title: "Транскрипция готова",
      body: "Документ обработан",
      payload: { fileId, filename },
    }).catch(() => {});

    const transcriptionTokens = estimateTranscriptionTokens(durationMinutes, result.text.length);
    await recordTokenUsageEvent({
      userId,
      category: "TRANSCRIPTION",
      sourceType: "transcription",
      sourceId: fileId,
      tokensIn: transcriptionTokens,
      tokensTotal: transcriptionTokens,
      provider: providerKey,
      model: modelDisplay,
      metadata: {
        estimated: true,
        durationMinutes,
        textLength: result.text.length,
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
    const errMsg = error instanceof Error ? error.message : String(error);
    createNotificationIfEnabled({
      userId,
      type: "AI_TASK",
      category: "error",
      title: "Транскрипция не удалась",
      body: errMsg.length > 200 ? errMsg.slice(0, 200) + "…" : errMsg,
      payload: { fileId, filename },
    }).catch(() => {});
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
