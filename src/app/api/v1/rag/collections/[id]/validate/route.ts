import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isProcessable } from "@/lib/docling/processing-service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/rag/collections/[id]/validate — check which files can be vectorized.
 * Returns processable and skipped files with reasons.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
    include: {
      files: {
        include: {
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const processable: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
  }> = [];
  const skipped: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    reason: string;
  }> = [];

  for (const { file } of collection.files) {
    const item = {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
    };
    if (isProcessable(file.mimeType)) {
      processable.push(item);
    } else {
      skipped.push({
        ...item,
        reason: "Формат не поддерживается для векторизации",
      });
    }
  }

  return NextResponse.json({
    collectionId: id,
    collectionName: collection.name,
    processable,
    skipped,
    processableCount: processable.length,
    skippedCount: skipped.length,
  });
}
