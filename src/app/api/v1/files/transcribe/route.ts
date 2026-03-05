import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  transcribeFile,
  getTranscriptionStatus,
  isTranscribable,
} from "@/lib/docling/transcription-service";
import { getDoclingClient } from "@/lib/docling/client";
import { getUserPlan } from "@/lib/plan-service";
import { getTranscriptionMinutesUsedThisMonth } from "@/lib/ai/transcription-usage";

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/**
 * POST /api/v1/files/transcribe — start audio/video transcription
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

  const docling = getDoclingClient();
  const available = await docling.isAvailable();
  if (!available) {
    return NextResponse.json(
      { error: "Сервис транскрибации недоступен (Docling)" },
      { status: 503 },
    );
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true, s3Key: true, name: true, mimeType: true, mediaMetadata: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается для транскрибации` },
      { status: 415 },
    );
  }

  const metadata = file.mediaMetadata as { durationSeconds?: number } | null;
  const durationSeconds = metadata?.durationSeconds;
  if (
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Длительность файла неизвестна. Для транскрибации загрузите аудио или видео с метаданными длительности.",
        code: "DURATION_UNKNOWN",
      },
      { status: 400 },
    );
  }
  const durationMinutes = Math.ceil(durationSeconds / 60);

  const plan = await getUserPlan(userId);
  const maxVideo = plan?.maxTranscriptionVideoMinutes ?? 60;
  const maxAudio = plan?.maxTranscriptionAudioMinutes ?? 120;
  const quota = plan?.transcriptionMinutesQuota ?? null;

  if (isVideoMime(file.mimeType) && durationMinutes > maxVideo) {
    return NextResponse.json(
      {
        error: `Видео не должно превышать ${maxVideo} минут по вашему тарифу`,
        code: "MAX_VIDEO_MINUTES_EXCEEDED",
        maxMinutes: maxVideo,
      },
      { status: 403 },
    );
  }
  if (!isVideoMime(file.mimeType) && durationMinutes > maxAudio) {
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
    if (used + durationMinutes > quota) {
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

  return NextResponse.json(
    { status: "processing", fileId: file.id, message: "Транскрибация запущена" },
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
