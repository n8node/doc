-- Add embedding config to VectorCollection and UserAiConfig
-- Collection config overrides user config (merged at runtime)

ALTER TABLE "vector_collections" ADD COLUMN IF NOT EXISTS "embedding_config" JSONB;

ALTER TABLE "user_ai_configs" ADD COLUMN IF NOT EXISTS "embedding_config" JSONB;
