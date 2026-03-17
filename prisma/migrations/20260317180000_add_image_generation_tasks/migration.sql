-- CreateTable
CREATE TABLE "image_generation_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kie_task_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cost_credits" INTEGER,
    "result_url" TEXT,
    "file_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_generation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_generation_tasks_user_id_created_at_idx" ON "image_generation_tasks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "image_generation_tasks_kie_task_id_idx" ON "image_generation_tasks"("kie_task_id");

-- AddForeignKey
ALTER TABLE "image_generation_tasks" ADD CONSTRAINT "image_generation_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
