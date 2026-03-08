import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isProcessable } from "@/lib/docling/processing-service";

/**
 * GET /api/v1/rag/collections — list RAG collections (vector "brains").
 * Auth: session or API key.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    filesCount: c.files.length,
    processableCount: c.files.filter((f) => isProcessable(f.file.mimeType)).length,
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

  const collection = await prisma.vectorCollection.create({
    data: {
      userId,
      name: name.slice(0, 255),
      folderId,
      files: {
        create: validFileIds.map((fileId) => ({ fileId })),
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
    isProcessable(f.file.mimeType)
  ).length;

  return NextResponse.json({
    id: collection.id,
    name: collection.name,
    folderId: collection.folderId,
    folder: collection.folder,
    filesCount: collection.files.length,
    processableCount,
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
