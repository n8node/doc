-- Create AiTaskType if not exists (check in public schema)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'AiTaskType' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE "AiTaskType" AS ENUM ('EMBEDDING', 'ANALYSIS', 'OCR', 'SUMMARIZE', 'CLASSIFY', 'TRANSCRIPTION');
    ELSE
        ALTER TYPE "AiTaskType" ADD VALUE IF NOT EXISTS 'TRANSCRIPTION';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- type or value already exists
END $$;

-- Create AiProviderPurpose if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'AiProviderPurpose' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE "AiProviderPurpose" AS ENUM ('EMBEDDING_CHAT', 'TRANSCRIPTION');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable ai_providers
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "purpose" "AiProviderPurpose" NOT NULL DEFAULT 'EMBEDDING_CHAT';

-- AlterTable plans
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "transcription_minutes_quota" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_transcription_video_minutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_transcription_audio_minutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "transcription_provider_id" TEXT;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'plans_transcription_provider_id_fkey'
    ) THEN
        ALTER TABLE "plans" ADD CONSTRAINT "plans_transcription_provider_id_fkey" 
        FOREIGN KEY ("transcription_provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
