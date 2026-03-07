-- AlterTable
ALTER TABLE "telegram_login_tokens" ADD COLUMN "link_user_id" TEXT;

-- CreateIndex
CREATE INDEX "telegram_login_tokens_link_user_id_idx" ON "telegram_login_tokens"("link_user_id");
