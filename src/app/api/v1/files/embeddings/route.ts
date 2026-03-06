import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/files/embeddings — list files that have embeddings (AI processed).
 * Auth: session or API key.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileIdRows = await prisma.$queryRaw<{ file_id: string }[]>`
    SELECT DISTINCT de.file_id FROM document_embeddings de
    JOIN files f ON f.id = de.file_id
    WHERE f.user_id = ${userId} AND f.deleted_at IS NULL
  `;
  const ids = fileIdRows.map((r) => r.file_id);
  if (ids.length === 0) {
    return NextResponse.json({ files: [] });
  }

  const files = await prisma.file.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      aiMetadata: true,
      folderId: true,
      folder: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  const counts = await Promise.all(
    files.map((f) =>
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM document_embeddings WHERE file_id = ${f.id}
      `,
    ),
  );

  const items = files.map((f, i) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: Number(f.size),
    aiMetadata: f.aiMetadata,
    folder: f.folder,
    embeddingsCount: Number(counts[i][0].count),
    createdAt: f.createdAt.toISOString(),
  }));

  return NextResponse.json({ files: items });
}
