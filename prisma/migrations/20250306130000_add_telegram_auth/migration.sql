-- AlterTable
ALTER TABLE "users" ADD COLUMN "telegram_user_id" BIGINT,
ADD COLUMN "telegram_username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateTable
CREATE TABLE "telegram_login_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "telegram_user_id" BIGINT,
    "telegram_username" TEXT,
    "telegram_first_name" TEXT,
    "telegram_last_name" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_login_tokens_token_key" ON "telegram_login_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_login_tokens_token_idx" ON "telegram_login_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_login_tokens_expires_at_idx" ON "telegram_login_tokens"("expires_at");
