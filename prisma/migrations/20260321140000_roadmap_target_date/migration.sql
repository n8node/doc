-- Замена текстовой даты на календарную дату
ALTER TABLE "roadmap_steps" ADD COLUMN "target_date" DATE;

UPDATE "roadmap_steps" SET "target_date" = CAST("created_at" AS DATE) WHERE "target_date" IS NULL;

ALTER TABLE "roadmap_steps" ALTER COLUMN "target_date" SET NOT NULL;

ALTER TABLE "roadmap_steps" DROP COLUMN "date_label";
