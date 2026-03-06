import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Raw SQL operations for pgvector embeddings.
 * Prisma doesn't support the vector type natively, so we use $queryRaw / $executeRaw.
 */

export async function insertEmbedding(params: {
  id: string;
  fileId: string;
  vector: number[];
  chunkText: string;
  contentHash: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const vectorStr = `[${params.vector.join(",")}]`;
  const metaJson = params.metadata ? JSON.stringify(params.metadata) : null;

  await prisma.$executeRaw`
    INSERT INTO document_embeddings (id, file_id, vector, chunk_text, content_hash, chunk_index, metadata, created_at)
    VALUES (
      ${params.id},
      ${params.fileId},
      ${vectorStr}::vector,
      ${params.chunkText},
      ${params.contentHash},
      ${params.chunkIndex},
      ${metaJson}::jsonb,
      NOW()
    )
  `;
}

export interface SimilarityResult {
  id: string;
  fileId: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

export async function findSimilar(
  queryVector: number[],
  userId: string,
  limit = 10,
  threshold = 0.7,
): Promise<SimilarityResult[]> {
  const vectorStr = `[${queryVector.join(",")}]`;

  const results = await prisma.$queryRaw<SimilarityResult[]>`
    SELECT
      de.id,
      de.file_id AS "fileId",
      de.chunk_text AS "chunkText",
      de.chunk_index AS "chunkIndex",
      1 - (de.vector <=> ${vectorStr}::vector) AS similarity,
      de.metadata
    FROM document_embeddings de
    JOIN files f ON f.id = de.file_id
    WHERE f.user_id = ${userId}
      AND f.deleted_at IS NULL
      AND 1 - (de.vector <=> ${vectorStr}::vector) >= ${threshold}
    ORDER BY de.vector <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * Find similar embeddings for a single file (RAG per file).
 * Ensures user has access via file ownership check.
 */
export async function findSimilarForFile(
  queryVector: number[],
  fileId: string,
  userId: string,
  limit = 10,
  threshold = 0.7,
): Promise<SimilarityResult[]> {
  const vectorStr = `[${queryVector.join(",")}]`;

  const results = await prisma.$queryRaw<SimilarityResult[]>`
    SELECT
      de.id,
      de.file_id AS "fileId",
      de.chunk_text AS "chunkText",
      de.chunk_index AS "chunkIndex",
      1 - (de.vector <=> ${vectorStr}::vector) AS similarity,
      de.metadata
    FROM document_embeddings de
    JOIN files f ON f.id = de.file_id
    WHERE de.file_id = ${fileId}
      AND f.user_id = ${userId}
      AND f.deleted_at IS NULL
      AND 1 - (de.vector <=> ${vectorStr}::vector) >= ${threshold}
    ORDER BY de.vector <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * Get chunks for a file in document order (fallback when semantic search returns nothing).
 * For free-form questions like "расскажи про документ".
 */
export async function getChunksForFile(
  fileId: string,
  userId: string,
  limit = 15,
): Promise<Array<{ chunkText: string; chunkIndex: number }>> {
  const results = await prisma.$queryRaw<Array<{ chunk_text: string; chunk_index: number }>>`
    SELECT de.chunk_text, de.chunk_index
    FROM document_embeddings de
    JOIN files f ON f.id = de.file_id
    WHERE de.file_id = ${fileId}
      AND f.user_id = ${userId}
      AND f.deleted_at IS NULL
    ORDER BY de.chunk_index ASC
    LIMIT ${limit}
  `;
  return results.map((r) => ({ chunkText: r.chunk_text, chunkIndex: r.chunk_index }));
}

export async function deleteEmbeddingsByFileId(fileId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM document_embeddings WHERE file_id = ${fileId}
  `;
}

export interface EmbeddingListItem {
  id: string;
  chunkIndex: number;
  chunkText: string;
  createdAt: Date;
}

export async function listEmbeddings(
  fileId: string,
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: EmbeddingListItem[]; total: number }> {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!file) return { items: [], total: 0 };

  const offset = (page - 1) * limit;
  const [items, countResult] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; chunk_index: number; chunk_text: string; created_at: Date }>>`
      SELECT id, chunk_index, chunk_text, created_at
      FROM document_embeddings
      WHERE file_id = ${fileId}
      ORDER BY chunk_index ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM document_embeddings WHERE file_id = ${fileId}
    `,
  ]);

  return {
    items: items.map((r) => ({
      id: r.id,
      chunkIndex: r.chunk_index,
      chunkText: r.chunk_text,
      createdAt: r.created_at,
    })),
    total: Number(countResult[0].count),
  };
}

export async function deleteEmbeddingsByIds(
  fileId: string,
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!file) return 0;

  const result = await prisma.$executeRaw(
    Prisma.sql`DELETE FROM document_embeddings WHERE file_id = ${fileId} AND id = ANY(${ids})`,
  );
  return typeof result === "number" ? result : 0;
}

export async function hasEmbeddings(fileId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM document_embeddings WHERE file_id = ${fileId}
  `;
  return Number(result[0].count) > 0;
}

export async function verifyPgvectorExtension(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<[{ installed: boolean }]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS installed
    `;
    return result[0].installed;
  } catch {
    return false;
  }
}
