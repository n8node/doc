-- AlterTable
ALTER TABLE "plans"
ADD COLUMN "chat_tokens_quota" INTEGER,
ADD COLUMN "search_tokens_quota" INTEGER,
ADD COLUMN "transcription_tokens_quota" INTEGER;

-- CreateEnum
CREATE TYPE "TokenUsageCategory" AS ENUM ('CHAT_DOCUMENT', 'SEARCH', 'EMBEDDING', 'TRANSCRIPTION');

-- CreateTable
CREATE TABLE "token_usage_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "TokenUsageCategory" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "tokens_total" INTEGER NOT NULL,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_events_user_id_created_at_idx" ON "token_usage_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "token_usage_events_user_id_category_created_at_idx" ON "token_usage_events"("user_id", "category", "created_at" DESC);

-- CreateIndex
CREATE INDEX "token_usage_events_source_type_source_id_idx" ON "token_usage_events"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "token_usage_events" ADD CONSTRAINT "token_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
