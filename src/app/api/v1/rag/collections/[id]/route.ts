import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { deleteEmbeddingsByFileId } from "@/lib/docling/vector-store";
import {
  checkRagMemoryAccess,
  getRagDocumentsQuotaStatus,
} from "@/lib/rag/access";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rag/collections/[id] — get RAG collection by id.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
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

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: collection.id,
    name: collection.name,
    folderId: collection.folderId,
    folder: collection.folder,
    filesCount: collection.files.length,
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

/**
 * PATCH /api/v1/rag/collections/[id] — update RAG collection.
 * Body: { name?: string, folderId?: string | null, fileIds?: string[] }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;
  const body = await request.json();

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const updates: {
    name?: string;
    folderId?: string | null;
  } = {};

  if (body.name !== undefined && typeof body.name === "string") {
    updates.name = body.name.trim().slice(0, 255) || collection.name;
  }

  if (body.folderId !== undefined) {
    const folderId =
      body.folderId && typeof body.folderId === "string" ? body.folderId : null;
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId, deletedAt: null },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }
    updates.folderId = folderId;
  }

  if (body.fileIds !== undefined && Array.isArray(body.fileIds)) {
    const fileIds = (body.fileIds as unknown[]).filter(
      (id): id is string => typeof id === "string"
    );
    const validFiles = await prisma.file.findMany({
      where: { id: { in: fileIds }, userId, deletedAt: null },
      select: { id: true },
    });
    const validFileIds = validFiles.map((f) => f.id);
    const requestedFilesCount = validFileIds.length;
    let allowedFileIds = validFileIds;

    const ragQuota = await getRagDocumentsQuotaStatus(userId, {
      excludeCollectionId: id,
    });
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
      }
    }

    await prisma.vectorCollectionFile.deleteMany({
      where: { collectionId: id },
    });
    if (allowedFileIds.length > 0) {
      await prisma.vectorCollectionFile.createMany({
        data: allowedFileIds.map((fileId) => ({ collectionId: id, fileId })),
      });
    }
  }

  const updated = await prisma.vectorCollection.update({
    where: { id },
    data: updates,
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

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    folderId: updated.folderId,
    folder: updated.folder,
    filesCount: updated.files.length,
    files: updated.files.map((f) => ({
      id: f.file.id,
      name: f.file.name,
      mimeType: f.file.mimeType,
      size: Number(f.file.size),
      hasEmbedding: f.file.hasEmbedding,
    })),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/**
 * DELETE /api/v1/rag/collections/[id] — delete RAG collection.
 * Removes embeddings for all files in the collection; files remain on disk.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
    include: { files: { select: { fileId: true } } },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const fileIds = collection.files.map((f) => f.fileId);
  for (const fileId of fileIds) {
    await deleteEmbeddingsByFileId(fileId);
    await prisma.file.update({
      where: { id: fileId },
      data: { hasEmbedding: false },
    });
  }

  await prisma.vectorCollection.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
