import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  transcribeFile,
  getTranscriptionStatus,
  isTranscribable,
} from "@/lib/docling/transcription-service";
import { getDoclingClient } from "@/lib/docling/client";

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

  const existing = await getTranscriptionStatus(fileId);
  if (existing?.status === "processing") {
    return NextResponse.json(
      { error: "Файл уже транскрибируется", status: existing.status },
      { status: 409 },
    );
  }

  transcribeFile(file.id, file.s3Key, file.name, file.mimeType, userId).catch(
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
