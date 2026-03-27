-- CreateEnum
CREATE TYPE "MailBridgeProvider" AS ENUM ('YANDEX');

-- CreateTable
CREATE TABLE "mail_bridge_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "MailBridgeProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "encrypted_credentials" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "sync_days_back" INTEGER NOT NULL DEFAULT 90,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_bridge_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_bridge_folder_states" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL DEFAULT 'INBOX',
    "uid_validity" TEXT NOT NULL,
    "highest_uid" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_bridge_folder_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_bridge_messages" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL DEFAULT 'INBOX',
    "imap_uid" INTEGER NOT NULL,
    "uid_validity" TEXT NOT NULL,
    "message_id_header" TEXT,
    "subject" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "body_text" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_bridge_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_bridge_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_token" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_bridge_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_bridge_accounts_user_id_email_key" ON "mail_bridge_accounts"("user_id", "email");

-- CreateIndex
CREATE INDEX "mail_bridge_accounts_user_id_idx" ON "mail_bridge_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_bridge_folder_states_account_id_folder_path_key" ON "mail_bridge_folder_states"("account_id", "folder_path");

-- CreateIndex
CREATE INDEX "mail_bridge_folder_states_account_id_idx" ON "mail_bridge_folder_states"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_bridge_messages_account_id_folder_path_imap_uid_uid_validity_key" ON "mail_bridge_messages"("account_id", "folder_path", "imap_uid", "uid_validity");

-- CreateIndex
CREATE INDEX "mail_bridge_messages_account_id_date_idx" ON "mail_bridge_messages"("account_id", "date" DESC);

-- CreateIndex
CREATE INDEX "mail_bridge_messages_account_id_folder_path_idx" ON "mail_bridge_messages"("account_id", "folder_path");

-- CreateIndex
CREATE UNIQUE INDEX "mail_bridge_api_keys_key_token_key" ON "mail_bridge_api_keys"("key_token");

-- CreateIndex
CREATE INDEX "mail_bridge_api_keys_user_id_idx" ON "mail_bridge_api_keys"("user_id");

-- AddForeignKey
ALTER TABLE "mail_bridge_accounts" ADD CONSTRAINT "mail_bridge_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_bridge_folder_states" ADD CONSTRAINT "mail_bridge_folder_states_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_bridge_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_bridge_messages" ADD CONSTRAINT "mail_bridge_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_bridge_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_bridge_api_keys" ADD CONSTRAINT "mail_bridge_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
