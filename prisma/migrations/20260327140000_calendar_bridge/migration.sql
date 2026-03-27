-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('YANDEX');

-- CreateTable
CREATE TABLE "calendar_bridge_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "encrypted_credentials" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bridge_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bridge_subscriptions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "resource_href" TEXT NOT NULL,
    "display_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ctag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bridge_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bridge_events" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "object_href" TEXT NOT NULL,
    "etag" TEXT,
    "uid" TEXT NOT NULL,
    "recurrence_id" TEXT,
    "raw_ics" TEXT NOT NULL,
    "summary" TEXT,
    "location" TEXT,
    "description" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "updated_remote" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bridge_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bridge_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_token" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_bridge_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bridge_webhooks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bridge_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bridge_accounts_user_id_provider_key" ON "calendar_bridge_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "calendar_bridge_accounts_user_id_idx" ON "calendar_bridge_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bridge_subscriptions_account_id_resource_href_key" ON "calendar_bridge_subscriptions"("account_id", "resource_href");

-- CreateIndex
CREATE INDEX "calendar_bridge_subscriptions_account_id_idx" ON "calendar_bridge_subscriptions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bridge_events_subscription_id_object_href_key" ON "calendar_bridge_events"("subscription_id", "object_href");

-- CreateIndex
CREATE INDEX "calendar_bridge_events_subscription_id_start_at_idx" ON "calendar_bridge_events"("subscription_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bridge_api_keys_key_token_key" ON "calendar_bridge_api_keys"("key_token");

-- CreateIndex
CREATE INDEX "calendar_bridge_api_keys_user_id_idx" ON "calendar_bridge_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "calendar_bridge_webhooks_user_id_idx" ON "calendar_bridge_webhooks"("user_id");

-- AddForeignKey
ALTER TABLE "calendar_bridge_accounts" ADD CONSTRAINT "calendar_bridge_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bridge_subscriptions" ADD CONSTRAINT "calendar_bridge_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "calendar_bridge_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bridge_events" ADD CONSTRAINT "calendar_bridge_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "calendar_bridge_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bridge_api_keys" ADD CONSTRAINT "calendar_bridge_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bridge_webhooks" ADD CONSTRAINT "calendar_bridge_webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
