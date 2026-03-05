import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
