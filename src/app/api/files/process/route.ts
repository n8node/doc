import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  processDocument,
  getProcessingStatus,
  isProcessable,
} from "@/lib/docling/processing-service";
import { getDoclingClient } from "@/lib/docling/client";

/**
 * POST /api/files/process — start document processing for a file
 * Body: { fileId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await request.json();
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId: session.user.id, deletedAt: null },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!isProcessable(file.mimeType)) {
    return NextResponse.json(
      { error: `Format ${file.mimeType} is not supported for processing` },
      { status: 415 },
    );
  }

  const docling = getDoclingClient();
  const available = await docling.isAvailable();
  if (!available) {
    return NextResponse.json(
      { error: "Document processing service is unavailable" },
      { status: 503 },
    );
  }

  const existing = await getProcessingStatus(fileId);
  if (existing?.status === "processing") {
    return NextResponse.json(
      { error: "File is already being processed", status: existing.status },
      { status: 409 },
    );
  }

  try {
    const result = await processDocument(
      file.id,
      file.s3Key,
      file.name,
      file.mimeType,
      session.user.id,
    );
    return NextResponse.json({
      success: true,
      textLength: result.text.length,
      tablesCount: result.tables.length,
      numPages: result.numPages,
      contentHash: result.contentHash,
    });
  } catch (error) {
    console.error("[process] Document processing failed:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/files/process?fileId=xxx — check processing status
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId: session.user.id },
    select: { id: true, aiMetadata: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const status = await getProcessingStatus(fileId);
  return NextResponse.json({
    fileId,
    status: status?.status ?? "none",
    error: status?.error,
    metadata: file.aiMetadata,
  });
}
