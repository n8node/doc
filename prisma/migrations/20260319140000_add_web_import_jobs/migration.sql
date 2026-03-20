-- Web import (скрейп страниц по URL)
CREATE TABLE "web_import_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cancel_requested" BOOLEAN NOT NULL DEFAULT false,
    "input" JSONB NOT NULL,
    "state" JSONB,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "web_import_jobs_user_id_created_at_idx" ON "web_import_jobs"("user_id", "created_at" DESC);

ALTER TABLE "web_import_jobs" ADD CONSTRAINT "web_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
