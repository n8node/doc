-- CreateTable
CREATE TABLE "user_ai_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "base_url" TEXT,
    "api_key" TEXT,
    "folder_id" TEXT,
    "embedding_model" TEXT NOT NULL,
    "chat_model" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_configs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ai_tasks" ADD COLUMN "used_own_key" BOOLEAN DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_configs_user_id_key" ON "user_ai_configs"("user_id");

-- AddForeignKey
ALTER TABLE "user_ai_configs" ADD CONSTRAINT "user_ai_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
