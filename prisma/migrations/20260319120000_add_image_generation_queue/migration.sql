-- ImageGenerationTask: kie_task_id nullable (для задач в очереди)
ALTER TABLE "image_generation_tasks" ALTER COLUMN "kie_task_id" DROP NOT NULL;

-- Очередь задач генерации (при 429 от Kie)
CREATE TABLE IF NOT EXISTS "image_generation_queue" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_generation_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "image_generation_queue_task_id_key" ON "image_generation_queue"("task_id");
CREATE INDEX IF NOT EXISTS "image_generation_queue_status_created_at_idx" ON "image_generation_queue"("status", "created_at" ASC);
