-- CreateTable
CREATE TABLE "mail_bridge_folder_subscriptions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL,
    "display_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_bridge_folder_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_bridge_folder_subscriptions_account_id_folder_path_key" ON "mail_bridge_folder_subscriptions"("account_id", "folder_path");

-- CreateIndex
CREATE INDEX "mail_bridge_folder_subscriptions_account_id_idx" ON "mail_bridge_folder_subscriptions"("account_id");

-- AddForeignKey
ALTER TABLE "mail_bridge_folder_subscriptions" ADD CONSTRAINT "mail_bridge_folder_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_bridge_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Существующие ящики: по умолчанию синхронизировать только Входящие
INSERT INTO "mail_bridge_folder_subscriptions" ("id", "account_id", "folder_path", "display_name", "enabled", "created_at", "updated_at")
SELECT
    'mfs_inbox_' || "id",
    "id",
    'INBOX',
    'Входящие',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "mail_bridge_accounts"
WHERE NOT EXISTS (
    SELECT 1 FROM "mail_bridge_folder_subscriptions" s WHERE s."account_id" = "mail_bridge_accounts"."id"
);
