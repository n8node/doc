import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { deleteEmbeddingsByFileId } from "@/lib/docling/vector-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/rag/collections/[id]/embeddings — remove embeddings for all files in the collection.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
    include: {
      files: { select: { fileId: true } },
    },
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

  return NextResponse.json({
    ok: true,
    deletedFilesCount: fileIds.length,
  });
}
