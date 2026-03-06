import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { listEmbeddings, deleteEmbeddingsByIds, hasEmbeddings } from "@/lib/docling/vector-store";

/**
 * GET /api/v1/files/[id]/embeddings — list embeddings (chunks) for a file.
 * Query: page, limit
 * Auth: session or API key.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));

  const { items, total } = await listEmbeddings(fileId, userId, page, limit);

  return NextResponse.json({
    embeddings: items.map((e) => ({
      id: e.id,
      chunkIndex: e.chunkIndex,
      chunkText: e.chunkText,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  });
}

/**
 * DELETE /api/v1/files/[id]/embeddings — delete embeddings by ids.
 * Body: { ids: string[] }
 * Auth: session or API key.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
  let body: { ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body?.ids)
    ? (body.ids as string[]).filter((id) => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids array required and must not be empty" }, { status: 400 });
  }

  const deleted = await deleteEmbeddingsByIds(fileId, userId, ids);
  const remaining = await hasEmbeddings(fileId);
  if (!remaining) {
    await prisma.file.update({
      where: { id: fileId },
      data: { hasEmbedding: false },
    });
  }
  return NextResponse.json({ ok: true, deleted });
}
