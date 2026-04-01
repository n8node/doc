-- Отдельная квота кредитов на генерацию видео (тарифы)

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "video_generation_credits_quota" INTEGER;
