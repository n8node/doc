import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isTranscribable } from "@/lib/docling/transcription-service";
import { estimateTranscriptionTime } from "@/lib/docling/transcription-estimate";

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/**
 * GET /api/v1/files/transcribe/estimate?fileId=xxx — оценить время транскрибации аудио
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

  if (isVideoMime(file.mimeType)) {
    return NextResponse.json(
      { error: "Транскрибация видео временно недоступна", code: "VIDEO_DISABLED" },
      { status: 503 }
    );
  }

  if (!isTranscribable(file.mimeType)) {
    return NextResponse.json(
      { error: `Формат ${file.mimeType} не поддерживается для транскрибации` },
      { status: 415 }
    );
  }

  const metadata = file.mediaMetadata as { durationSeconds?: number } | null;
  let durationSeconds = metadata?.durationSeconds;

  let source: "metadata" | "file-size-fallback" = "metadata";
  // Fallback: ~2 min per MB for compressed audio, result in seconds
  if (
    (durationSeconds == null ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 0) &&
    file.size
  ) {
    const sizeMb = Number(file.size) / (1024 * 1024);
    const estimatedMinutes = Math.max(1, Math.min(120, Math.ceil(sizeMb * 2)));
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

  const estimate = estimateTranscriptionTime(durationSeconds, source);

  return NextResponse.json({
    fileId: file.id,
    estimatedProcessingSeconds: estimate.estimatedProcessingSeconds,
    estimatedProcessingMinutes: estimate.estimatedProcessingMinutes,
    audioDurationSeconds: estimate.audioDurationSeconds,
    source: estimate.source,
  });
}
