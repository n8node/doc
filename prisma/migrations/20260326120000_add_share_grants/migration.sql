-- CreateEnum
CREATE TYPE "ShareGrantStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "share_grants" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "target_type" TEXT NOT NULL,
    "share_target_key" TEXT NOT NULL,
    "file_id" TEXT,
    "folder_id" TEXT,
    "status" "ShareGrantStatus" NOT NULL DEFAULT 'PENDING',
    "allow_collections" BOOLEAN NOT NULL DEFAULT false,
    "allow_ai_features" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_grants_owner_user_id_recipient_email_share_target_key_key" ON "share_grants"("owner_user_id", "recipient_email", "share_target_key");

-- CreateIndex
CREATE INDEX "share_grants_owner_user_id_status_idx" ON "share_grants"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "share_grants_recipient_user_id_status_idx" ON "share_grants"("recipient_user_id", "status");

-- CreateIndex
CREATE INDEX "share_grants_recipient_email_status_idx" ON "share_grants"("recipient_email", "status");

-- CreateIndex
CREATE INDEX "share_grants_expires_at_idx" ON "share_grants"("expires_at");

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
