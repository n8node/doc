-- CreateIndex: GIN index for full-text search on document_embeddings.chunk_text
-- Enables fast FTS via to_tsvector('russian', chunk_text)
CREATE INDEX IF NOT EXISTS "document_embeddings_chunk_text_fts_idx" ON "document_embeddings" USING GIN (to_tsvector('russian', chunk_text));
