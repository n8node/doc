import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isTranscribable, isVideoMime } from "@/lib/docling/transcription-service";
import { estimateTranscriptionTime } from "@/lib/docling/transcription-estimate";
import { getTranscriptionProviderForUser } from "@/lib/ai/get-transcription-provider";
import { getUserPlan } from "@/lib/plan-service";
import {
  hasTranscriptionAudio,
  hasTranscriptionVideo,
} from "@/lib/plan-transcription-features";

/**
 * GET /api/v1/files/transcribe/estimate?fileId=xxx — оценить время транскрибации
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
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true, mimeType: true, mediaMetadata: true, size: true },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается для транскрибации` },
      { status: 415 }
    );
  }

  const plan = await getUserPlan(userId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  const feats = plan.features ?? {};
  const video = isVideoMime(file.mimeType);
  if (video) {
    if (!hasTranscriptionVideo(feats)) {
      return NextResponse.json(
        {
          error: "Транскрибация видео не включена в вашем тарифе",
          code: "TRANSCRIPTION_VIDEO_DISABLED",
        },
        { status: 403 },
      );
    }
  } else if (!hasTranscriptionAudio(feats)) {
    return NextResponse.json(
      {
        error: "Транскрибация аудио не включена в вашем тарифе",
        code: "TRANSCRIPTION_AUDIO_DISABLED",
      },
      { status: 403 },
    );
  }

  const metadata = file.mediaMetadata as { durationSeconds?: number } | null;
  let durationSeconds = metadata?.durationSeconds;

  let source: "metadata" | "file-size-fallback" = "metadata";
  if (
    (durationSeconds == null ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 0) &&
    file.size
  ) {
    const sizeMb = Number(file.size) / (1024 * 1024);
    const estimatedMinutes = video
      ? Math.max(1, Math.min(180, Math.ceil(sizeMb * 0.8)))
      : Math.max(1, Math.min(120, Math.ceil(sizeMb * 2)));
    durationSeconds = estimatedMinutes * 60;
    source = "file-size-fallback";
  }

  if (
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Длительность файла неизвестна. Загрузите аудио с метаданными длительности.",
        code: "DURATION_UNKNOWN",
      },
      { status: 400 }
    );
  }

  const provider = await getTranscriptionProviderForUser(userId);
  const useOpenAi =
    provider && (provider.name === "openai_whisper" || provider.baseUrl.includes("api.openai.com"));
  const useOpenRouter =
    provider &&
    (provider.name === "openrouter" ||
      provider.name === "openrouter_transcription" ||
      provider.baseUrl.includes("openrouter.ai"));
  const cloudProvider = !!(useOpenAi || useOpenRouter);

  const estimate = estimateTranscriptionTime(durationSeconds, source, {
    isVideo: video,
    cloudProvider,
  });

  return NextResponse.json({
    fileId: file.id,
    estimatedProcessingSeconds: estimate.estimatedProcessingSeconds,
    estimatedProcessingMinutes: estimate.estimatedProcessingMinutes,
    audioDurationSeconds: estimate.audioDurationSeconds,
    source: estimate.source,
  });
}
