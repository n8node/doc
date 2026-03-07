-- AlterTable (idempotent - safe if columns already exist from db push)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_user_id" BIGINT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_username" TEXT;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "telegram_login_tokens" (
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

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_login_tokens_token_key" ON "telegram_login_tokens"("token");
CREATE INDEX IF NOT EXISTS "telegram_login_tokens_token_idx" ON "telegram_login_tokens"("token");
CREATE INDEX IF NOT EXISTS "telegram_login_tokens_expires_at_idx" ON "telegram_login_tokens"("expires_at");
