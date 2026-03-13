-- Remove transcription tokens quota: billing for transcription is by minutes, not tokens.
-- AlterTable
ALTER TABLE "plans" DROP COLUMN IF EXISTS "transcription_tokens_quota";
