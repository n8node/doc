-- Add variant to image_generation_tasks (e.g. flux-kontext-pro, flux-kontext-max)
ALTER TABLE "image_generation_tasks" ADD COLUMN IF NOT EXISTS "variant" TEXT;

-- Kie pricing: modelId + variant -> priceCredits, priceUsd (synced from kie.ai/pricing daily)
CREATE TABLE IF NOT EXISTS "kie_pricing" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "variant" TEXT,
    "price_credits" INTEGER NOT NULL,
    "price_usd" DOUBLE PRECISION,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kie_pricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kie_pricing_model_id_variant_key" ON "kie_pricing"("model_id", "variant");
CREATE INDEX IF NOT EXISTS "kie_pricing_model_id_idx" ON "kie_pricing"("model_id");
