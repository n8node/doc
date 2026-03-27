import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  transcribeFile,
  getTranscriptionStatus,
  isTranscribable,
  isVideoMime,
} from "@/lib/docling/transcription-service";
import { createNotificationIfEnabled, createQuota80WarningIfNeeded } from "@/lib/notification-service";
import { estimateTranscriptionTime } from "@/lib/docling/transcription-estimate";
import { getDoclingClient } from "@/lib/docling/client";
import { getUserPlan } from "@/lib/plan-service";
import {
  getTranscriptionAudioMinutesUsedThisMonth,
  getTranscriptionMinutesUsedThisMonth,
  getTranscriptionVideoMinutesUsedThisMonth,
} from "@/lib/ai/transcription-usage";
import { getTranscriptionQuotaDenyReason, isSplitTranscriptionQuotaMode } from "@/lib/ai/transcription-quota";
import { getTranscriptionProviderForUser } from "@/lib/ai/get-transcription-provider";

/**
 * POST /api/v1/files/transcribe — транскрибация аудио или видео (извлечение дорожки + облако по сегментам)
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
  const useOpenRouter =
    provider &&
    (provider.name === "openrouter" ||
      provider.name === "openrouter_transcription" ||
      provider.baseUrl.includes("openrouter.ai"));

  if (!useOpenAi && !useOpenRouter) {
    const docling = getDoclingClient();
    const available = await docling.isAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Сервис транскрибации недоступен (QoQon)" },
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

  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается для транскрибации` },
      { status: 415 },
    );
  }

  const video = isVideoMime(file.mimeType);
  const metadata = file.mediaMetadata as { durationSeconds?: number } | null;
  let durationSeconds = metadata?.durationSeconds;
  let durationSource: "metadata" | "file-size-fallback" = "metadata";

  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    if (file.size) {
      const sizeMb = Number(file.size) / (1024 * 1024);
      if (video) {
        const estimatedMinutes = Math.max(1, Math.min(180, Math.ceil(sizeMb * 0.8)));
        durationSeconds = estimatedMinutes * 60;
      } else {
        const estimatedMinutes = Math.max(1, Math.min(120, Math.ceil(sizeMb * 2)));
        durationSeconds = estimatedMinutes * 60;
      }
      durationSource = "file-size-fallback";
    }
  }

  if (
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Длительность файла неизвестна. Для транскрибации загрузите файл с метаданными длительности или меньшего размера для оценки.",
        code: "DURATION_UNKNOWN",
      },
      { status: 400 },
    );
  }
  const durationMinutes = Math.ceil(durationSeconds / 60);

  const plan = await getUserPlan(userId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const maxVideo = plan.maxTranscriptionVideoMinutes ?? 60;
  const maxAudio = plan.maxTranscriptionAudioMinutes ?? 120;

  if (video && durationMinutes > maxVideo) {
    return NextResponse.json(
      {
        error: `Видео не должно превышать ${maxVideo} минут по вашему тарифу`,
        code: "MAX_VIDEO_MINUTES_EXCEEDED",
        maxMinutes: maxVideo,
      },
      { status: 403 },
    );
  }
  if (!video && durationMinutes > maxAudio) {
    return NextResponse.json(
      {
        error: `Аудио не должно превышать ${maxAudio} минут по вашему тарифу`,
        code: "MAX_AUDIO_MINUTES_EXCEEDED",
        maxMinutes: maxAudio,
      },
      { status: 403 },
    );
  }

  const quotaFields = {
    transcriptionMinutesQuota: plan.transcriptionMinutesQuota,
    transcriptionAudioMinutesQuota: plan.transcriptionAudioMinutesQuota,
    transcriptionVideoMinutesQuota: plan.transcriptionVideoMinutesQuota,
  };

  const deny = await getTranscriptionQuotaDenyReason(
    userId,
    quotaFields,
    video ? "video" : "audio",
    durationMinutes,
  );
  if (deny) {
    createNotificationIfEnabled({
      userId,
      type: "QUOTA",
      category: "warning",
      title: "Лимит транскрибации исчерпан",
      body: deny.message,
      payload: { used: deny.used, quota: deny.quota },
    }).catch(() => {});
    return NextResponse.json(
      {
        error: deny.message,
        code: deny.code,
        used: deny.used,
        quota: deny.quota,
      },
      { status: 403 },
    );
  }

  if (!isSplitTranscriptionQuotaMode(quotaFields)) {
    const q = plan.transcriptionMinutesQuota;
    if (q != null) {
      const used = await getTranscriptionMinutesUsedThisMonth(userId);
      createQuota80WarningIfNeeded(userId, used, q, "transcription").catch(() => {});
    }
  } else {
    if (video) {
      const q =
        plan.transcriptionVideoMinutesQuota ?? plan.transcriptionMinutesQuota ?? null;
      if (q != null) {
        const used = await getTranscriptionVideoMinutesUsedThisMonth(userId);
        createQuota80WarningIfNeeded(userId, used, q, "transcription").catch(() => {});
      }
    } else {
      const q =
        plan.transcriptionAudioMinutesQuota ?? plan.transcriptionMinutesQuota ?? null;
      if (q != null) {
        const used = await getTranscriptionAudioMinutesUsedThisMonth(userId);
        createQuota80WarningIfNeeded(userId, used, q, "transcription").catch(() => {});
      }
    }
  }

  const existing = await getTranscriptionStatus(fileId);
  if (existing?.status === "processing") {
    return NextResponse.json(
      { error: "Файл уже транскрибируется", status: existing.status },
      { status: 409 },
    );
  }

  const sourceKind = video ? "video" : "audio";

  transcribeFile(
    file.id,
    file.s3Key,
    file.name,
    file.mimeType,
    userId,
    durationMinutes,
    sourceKind,
  ).catch((err) => {
    console.error("[transcribe] Background failed:", err);
  });

  const estimate = estimateTranscriptionTime(durationSeconds, durationSource, {
    isVideo: video,
    cloudProvider: !!(useOpenAi || useOpenRouter),
  });

  const providerDisplay = useOpenRouter
    ? "OpenRouter"
    : useOpenAi && provider?.name === "openai_whisper"
      ? "OpenAI"
      : useOpenAi && provider?.baseUrl.includes("api.openai.com")
        ? "OpenAI"
        : "QoQon";

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
