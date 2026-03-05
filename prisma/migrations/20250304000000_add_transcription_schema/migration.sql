-- CreateEnum
CREATE TYPE "AiProviderPurpose" AS ENUM ('EMBEDDING_CHAT', 'TRANSCRIPTION');

-- AlterEnum
ALTER TYPE "AiTaskType" ADD VALUE 'TRANSCRIPTION';

-- AlterTable
ALTER TABLE "ai_providers" ADD COLUMN "purpose" "AiProviderPurpose" NOT NULL DEFAULT 'EMBEDDING_CHAT';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "transcription_minutes_quota" INTEGER,
ADD COLUMN "max_transcription_video_minutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "max_transcription_audio_minutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "transcription_provider_id" TEXT;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_transcription_provider_id_fkey" FOREIGN KEY ("transcription_provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
