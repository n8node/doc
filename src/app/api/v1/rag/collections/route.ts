import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isProcessable } from "@/lib/docling/processing-service";
import {
  checkRagMemoryAccess,
  getRagDocumentsQuotaStatus,
} from "@/lib/rag/access";

/**
 * GET /api/v1/rag/collections — list RAG collections (vector "brains").
 * Auth: session or API key.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const collections = await prisma.vectorCollection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      folder: { select: { id: true, name: true } },
      files: {
        include: {
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
              hasEmbedding: true,
            },
          },
        },
      },
    },
  });

  const items = collections.map((c) => ({
    id: c.id,
    name: c.name,
    folderId: c.folderId,
    folder: c.folder,
    embeddingConfig: c.embeddingConfig,
    filesCount: c.files.length,
    processableCount: c.files.filter((f) => isProcessable(f.file.mimeType, f.file.name)).length,
    filesWithEmbeddings: c.files.filter((f) => f.file.hasEmbedding).length,
    files: c.files.map((f) => ({
      id: f.file.id,
      name: f.file.name,
      mimeType: f.file.mimeType,
      size: Number(f.file.size),
      hasEmbedding: f.file.hasEmbedding,
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return NextResponse.json({ collections: items });
}

/**
 * POST /api/v1/rag/collections — create RAG collection.
 * Body: { name: string, folderId?: string, fileIds?: string[] }
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const folderId = body.folderId && typeof body.folderId === "string" ? body.folderId : null;
  const fileIds = Array.isArray(body.fileIds)
    ? (body.fileIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId, deletedAt: null },
    });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  const validFileIds: string[] = [];

  if (folderId) {
    const folderFiles = await prisma.file.findMany({
      where: { folderId, userId, deletedAt: null },
      select: { id: true },
    });
    validFileIds.push(...folderFiles.map((f) => f.id));
  }

  if (fileIds.length > 0) {
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, userId, deletedAt: null },
      select: { id: true },
    });
    const ids = files.map((f) => f.id);
    for (const id of ids) {
      if (!validFileIds.includes(id)) validFileIds.push(id);
    }
  }

  const requestedFilesCount = validFileIds.length;
  let allowedFileIds = validFileIds;
  let quotaWarning: string | null = null;

  const ragQuota = await getRagDocumentsQuotaStatus(userId);
  if (ragQuota.quota != null) {
    const available = ragQuota.available ?? 0;
    if (requestedFilesCount > 0 && available <= 0) {
      return NextResponse.json(
        {
          error:
            `Лимит документов RAG по вашему тарифу исчерпан (${ragQuota.used}/${ragQuota.quota}). ` +
            "Удалите часть коллекций или обновите тариф.",
          code: "RAG_DOCUMENTS_QUOTA_EXCEEDED",
          quota: ragQuota.quota,
          used: ragQuota.used,
        },
        { status: 403 }
      );
    }
    if (requestedFilesCount > available) {
      allowedFileIds = validFileIds.slice(0, available);
      quotaWarning =
        `По тарифу в коллекцию добавлено ${allowedFileIds.length} из ${requestedFilesCount} документов. ` +
        `Лимит: ${ragQuota.quota} документов, занято: ${ragQuota.used}.`;
    }
  }

  const collection = await prisma.vectorCollection.create({
    data: {
      userId,
      name: name.slice(0, 255),
      folderId,
      files: {
        create: allowedFileIds.map((fileId) => ({ fileId })),
      },
    },
    include: {
      folder: { select: { id: true, name: true } },
      files: {
        include: {
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
              hasEmbedding: true,
            },
          },
        },
      },
    },
  });

  const processableCount = collection.files.filter((f) =>
    isProcessable(f.file.mimeType, f.file.name)
  ).length;

  return NextResponse.json({
    id: collection.id,
    name: collection.name,
    folderId: collection.folderId,
    folder: collection.folder,
    filesCount: collection.files.length,
    processableCount,
    quotaWarning,
    files: collection.files.map((f) => ({
      id: f.file.id,
      name: f.file.name,
      mimeType: f.file.mimeType,
      size: Number(f.file.size),
      hasEmbedding: f.file.hasEmbedding,
    })),
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  });
}
