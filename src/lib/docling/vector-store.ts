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

/**
 * Escape LIKE pattern special chars: % and _
 */
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Full-text search: chunks matching query via PostgreSQL FTS (russian config).
 * Uses ts_rank for relevance ordering. Falls back to ILIKE if FTS returns nothing.
 * @param fileIds - optional: restrict search to these file IDs (e.g. from RAG collection)
 */
export async function findSimilarByKeyword(
  userId: string,
  query: string,
  limit = 20,
  fileIds?: string[],
): Promise<SimilarityResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  const fileFilter =
    fileIds && fileIds.length > 0
      ? Prisma.sql`AND de.file_id = ANY(${fileIds}::text[])`
      : Prisma.sql``;

  try {
    const results = await prisma.$queryRaw<
      Array<{ id: string; file_id: string; chunk_text: string; chunk_index: number; metadata: unknown; rank: number }>
    >(Prisma.sql`
      SELECT de.id, de.file_id, de.chunk_text, de.chunk_index, de.metadata,
             ts_rank(to_tsvector('russian', de.chunk_text), plainto_tsquery('russian', ${trimmed})) AS rank
      FROM document_embeddings de
      JOIN files f ON f.id = de.file_id
      WHERE f.user_id = ${userId}
        AND f.deleted_at IS NULL
        AND to_tsvector('russian', de.chunk_text) @@ plainto_tsquery('russian', ${trimmed})
        ${fileFilter}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);

    if (results.length > 0) {
      const maxRank = Math.max(...results.map((r) => Number(r.rank)), 0.001);
      return results.map((r) => ({
        id: r.id,
        fileId: r.file_id,
        chunkText: r.chunk_text,
        chunkIndex: r.chunk_index,
        similarity: Math.min(1, Number(r.rank) / maxRank),
        metadata: (r.metadata as Record<string, unknown>) ?? null,
      }));
    }
  } catch {
    /* FTS may fail on edge cases, fall through to ILIKE */
  }

  /* Fallback: ILIKE for short queries or when FTS returns nothing */
  const conditions = words.map((w) => {
    const pattern = "%" + escapeLikePattern(w) + "%";
    return Prisma.sql`de.chunk_text ILIKE ${pattern}`;
  });
  const orClause = Prisma.join(conditions, " OR ");

  const fallbackResults = await prisma.$queryRaw<
    Array<{ id: string; file_id: string; chunk_text: string; chunk_index: number; metadata: unknown }>
  >(Prisma.sql`
    SELECT de.id, de.file_id, de.chunk_text, de.chunk_index, de.metadata
    FROM document_embeddings de
    JOIN files f ON f.id = de.file_id
    WHERE f.user_id = ${userId}
      AND f.deleted_at IS NULL
      AND (${orClause})
      ${fileFilter}
    LIMIT ${limit}
  `);

  return fallbackResults.map((r) => ({
    id: r.id,
    fileId: r.file_id,
    chunkText: r.chunk_text,
    chunkIndex: r.chunk_index,
    similarity: 1,
    metadata: (r.metadata as Record<string, unknown>) ?? null,
  }));
}

/**
 * Semantic similarity search.
 * @param fileIds - optional: restrict search to these file IDs (e.g. from RAG collection)
 */
export async function findSimilar(
  queryVector: number[],
  userId: string,
  limit = 10,
  threshold = 0.7,
  fileIds?: string[],
): Promise<SimilarityResult[]> {
  const vectorStr = `[${queryVector.join(",")}]`;

  if (fileIds && fileIds.length === 0) return [];

  const fileFilter =
    fileIds && fileIds.length > 0
      ? Prisma.sql`AND de.file_id = ANY(${fileIds}::text[])`
      : Prisma.sql``;

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
      ${fileFilter}
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

/**
 * Clear hasEmbedding flag and processedAt from aiMetadata for a file.
 * Preserves other aiMetadata fields (extractedText, tablesCount, etc.).
 */
export async function clearFileEmbeddingMarks(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { aiMetadata: true },
  });
  const meta = (file?.aiMetadata ?? {}) as Record<string, unknown>;
  const { processedAt: _, ...rest } = meta;
  await prisma.file.update({
    where: { id: fileId },
    data: {
      hasEmbedding: false,
      aiMetadata: Object.keys(rest).length > 0 ? rest : undefined,
    },
  });
}

export interface EmbeddingListItem {
  id: string;
  chunkIndex: number;
  chunkText: string;
  vectorPreview: string;
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
    prisma.$queryRaw<
      Array<{ id: string; chunk_index: number; chunk_text: string; vector_preview: string; created_at: Date }>
    >`
      SELECT id, chunk_index, chunk_text,
             LEFT(vector::text, 120) || CASE WHEN LENGTH(vector::text) > 120 THEN '...' ELSE '' END AS vector_preview,
             created_at
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
      vectorPreview: r.vector_preview ?? "",
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

export interface EmbeddingForExport {
  id: string;
  fileId: string;
  vector: number[];
  chunkText: string;
  contentHash: string;
  chunkIndex: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Get all embeddings for a RAG collection (owner-checked by caller).
 */
export async function getEmbeddingsForCollection(
  collectionId: string,
  fileIds: string[]
): Promise<EmbeddingForExport[]> {
  if (fileIds.length === 0) return [];

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      file_id: string;
      vector_text: string;
      chunk_text: string;
      content_hash: string;
      chunk_index: number;
      metadata: unknown;
    }>
  >(Prisma.sql`
    SELECT id, file_id, vector::text AS vector_text, chunk_text, content_hash, chunk_index, metadata
    FROM document_embeddings
    WHERE file_id IN (${Prisma.join(fileIds.map((f) => Prisma.sql`${f}`), ", ")})
    ORDER BY file_id, chunk_index
  `);

  return rows.map((r) => {
    let vector: number[] = [];
    try {
      const parsed = r.vector_text.replace(/^\[|\]$/g, "").split(",");
      vector = parsed.map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
    } catch {
      /* fallback empty */
    }
    return {
      id: r.id,
      fileId: r.file_id,
      vector,
      chunkText: r.chunk_text,
      contentHash: r.content_hash,
      chunkIndex: r.chunk_index,
      metadata: (r.metadata as Record<string, unknown>) ?? null,
    };
  });
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
