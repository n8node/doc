import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  transcribeFile,
  getTranscriptionStatus,
  isTranscribable,
} from "@/lib/docling/transcription-service";
import { createNotificationIfEnabled, createQuota80WarningIfNeeded } from "@/lib/notification-service";
import { estimateTranscriptionTime } from "@/lib/docling/transcription-estimate";
import { getDoclingClient } from "@/lib/docling/client";
import { getUserPlan } from "@/lib/plan-service";
import { getTranscriptionMinutesUsedThisMonth } from "@/lib/ai/transcription-usage";
import { getTranscriptionProviderForUser } from "@/lib/ai/get-transcription-provider";

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

// REMINDER: Video transcription is temporarily disabled. Restore when stable (memory, timeouts).
// Search for "REMINDER: Video transcription" to find all related commented code.

/**
 * POST /api/v1/files/transcribe — start audio transcription (video disabled)
 * Body: { fileId: string }
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fileId = body.fileId;
  if (!fileId || typeof fileId !== "string") {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const provider = await getTranscriptionProviderForUser(userId);
  const useOpenAi = provider && (provider.name === "openai_whisper" || provider.baseUrl.includes("api.openai.com"));

  if (!useOpenAi) {
    const docling = getDoclingClient();
    const available = await docling.isAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Сервис транскрибации недоступен (Docling)" },
        { status: 503 },
      );
    }
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true, s3Key: true, name: true, mimeType: true, mediaMetadata: true, size: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // REMINDER: Video transcription disabled. Re-enable by removing this block.
  if (isVideoMime(file.mimeType)) {
    return NextResponse.json(
      { error: "Транскрибация видео временно недоступна. Используйте аудиофайлы.", code: "VIDEO_DISABLED" },
      { status: 503 },
    );
  }

  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается для транскрибации` },
      { status: 415 },
    );
  }

  if (useOpenAi && Number(file.size) > 25 * 1024 * 1024) {
    return NextResponse.json(
      {
        error: "Файл слишком большой для OpenAI Whisper (макс. 25 МБ). Используйте файл меньше или другой тариф.",
        code: "OPENAI_FILE_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  const metadata = file.mediaMetadata as { durationSeconds?: number } | null;
  let durationSeconds = metadata?.durationSeconds;
  let durationSource: "metadata" | "file-size-fallback" = "metadata";
  // Fallback for audio: estimate duration from file size if unknown (~2 min per MB for compressed audio)
  if (
    (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds < 0) &&
    file.size
  ) {
    const sizeMb = Number(file.size) / (1024 * 1024);
    const estimatedMinutes = Math.max(1, Math.min(120, Math.ceil(sizeMb * 2)));
    durationSeconds = estimatedMinutes * 60;
    durationSource = "file-size-fallback";
  }
  if (
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Длительность файла неизвестна. Для транскрибации загрузите аудио с метаданными длительности.",
        code: "DURATION_UNKNOWN",
      },
      { status: 400 },
    );
  }
  const durationMinutes = Math.ceil(durationSeconds / 60);

  const plan = await getUserPlan(userId);
  // const maxVideo = plan?.maxTranscriptionVideoMinutes ?? 60; // REMINDER: Video disabled
  const maxAudio = plan?.maxTranscriptionAudioMinutes ?? 120;
  const quota = plan?.transcriptionMinutesQuota ?? null;

  // if (isVideoMime(file.mimeType) && durationMinutes > maxVideo) { ... } // REMINDER: Video disabled
  if (durationMinutes > maxAudio) {
    return NextResponse.json(
      {
        error: `Аудио не должно превышать ${maxAudio} минут по вашему тарифу`,
        code: "MAX_AUDIO_MINUTES_EXCEEDED",
        maxMinutes: maxAudio,
      },
      { status: 403 },
    );
  }

  if (quota != null) {
    const used = await getTranscriptionMinutesUsedThisMonth(userId);
    createQuota80WarningIfNeeded(userId, used, quota, "transcription").catch(() => {});
    if (used + durationMinutes > quota) {
      createNotificationIfEnabled({
        userId,
        type: "QUOTA",
        category: "warning",
        title: "Лимит транскрибации исчерпан",
        body: "Минут транскрибации по тарифу недостаточно. Обновите тариф или дождитесь следующего месяца.",
        payload: { used, quota },
      }).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Лимит минут транскрибации по вашему тарифу исчерпан. Обновите тариф или дождитесь следующего месяца.",
          code: "TRANSCRIPTION_QUOTA_EXCEEDED",
          used,
          quota,
        },
        { status: 403 },
      );
    }
  }

  const existing = await getTranscriptionStatus(fileId);
  if (existing?.status === "processing") {
    return NextResponse.json(
      { error: "Файл уже транскрибируется", status: existing.status },
      { status: 409 },
    );
  }

  transcribeFile(
    file.id,
    file.s3Key,
    file.name,
    file.mimeType,
    userId,
    durationMinutes,
  ).catch(
    (err) => {
      console.error("[transcribe] Background failed:", err);
    },
  );

  const estimate = estimateTranscriptionTime(durationSeconds, durationSource);

  const providerDisplay =
    useOpenAi && provider?.name === "openai_whisper"
      ? "OpenAI"
      : useOpenAi && provider?.baseUrl.includes("api.openai.com")
        ? "OpenAI"
        : "Docling";

  return NextResponse.json(
    {
      status: "processing",
      fileId: file.id,
      message: "Транскрибация запущена",
      estimatedProcessingSeconds: estimate.estimatedProcessingSeconds,
      estimatedProcessingMinutes: estimate.estimatedProcessingMinutes,
      provider: providerDisplay,
    },
    { status: 202 },
  );
}

/**
 * GET /api/v1/files/transcribe?fileId=xxx — check transcription status
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

  const status = await getTranscriptionStatus(fileId);
  const metadata = file.aiMetadata as Record<string, unknown> | null;
  return NextResponse.json({
    fileId,
    status: status?.status ?? "none",
    error: status?.error,
    transcriptText: metadata?.transcriptText ?? null,
    transcriptProcessedAt: metadata?.transcriptProcessedAt ?? null,
  });
}
