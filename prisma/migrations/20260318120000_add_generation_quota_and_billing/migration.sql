-- Plan: квота кредитов на генерацию в месяц (null = без лимита)
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "image_generation_credits_quota" INTEGER;

-- ImageGenerationTask: billed credits для учёта квоты и списания с кошелька
ALTER TABLE "image_generation_tasks" ADD COLUMN IF NOT EXISTS "billed_credits" INTEGER;
