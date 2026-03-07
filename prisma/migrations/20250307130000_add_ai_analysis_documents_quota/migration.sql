-- AlterTable plans: AI analysis documents quota (documents per month, null = unlimited)
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "ai_analysis_documents_quota" INTEGER;
