-- Video generation (Kie.ai Kling): tasks, queue, shared kie_pricing variants

CREATE TABLE "video_generation_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kie_task_id" TEXT,
    "model_id" TEXT NOT NULL,
    "variant" TEXT,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cost_credits" INTEGER,
    "billed_credits" INTEGER,
    "result_url" TEXT,
    "file_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_generation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_generation_queue" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_generation_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_generation_queue_task_id_key" ON "video_generation_queue"("task_id");
CREATE INDEX "video_generation_tasks_user_id_created_at_idx" ON "video_generation_tasks"("user_id", "created_at" DESC);
CREATE INDEX "video_generation_tasks_kie_task_id_idx" ON "video_generation_tasks"("kie_task_id");
CREATE INDEX "video_generation_queue_status_created_at_idx" ON "video_generation_queue"("status", "created_at" ASC);

ALTER TABLE "video_generation_tasks" ADD CONSTRAINT "video_generation_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
