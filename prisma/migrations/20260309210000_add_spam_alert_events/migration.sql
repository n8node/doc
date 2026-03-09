-- CreateEnum
CREATE TYPE "SpamAlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "spam_alert_events" (
    "id" TEXT NOT NULL,
    "root_user_id" TEXT,
    "severity" "SpamAlertSeverity" NOT NULL,
    "score" INTEGER NOT NULL,
    "registrations_count" INTEGER NOT NULL,
    "verification_rate" DOUBLE PRECISION NOT NULL,
    "activity_rate" DOUBLE PRECISION NOT NULL,
    "unique_domains" INTEGER NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "cooldown_key" TEXT NOT NULL,
    "sent_to_telegram" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spam_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spam_alert_events_cooldown_key_key" ON "spam_alert_events"("cooldown_key");

-- CreateIndex
CREATE INDEX "spam_alert_events_root_user_id_created_at_idx" ON "spam_alert_events"("root_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "spam_alert_events_severity_created_at_idx" ON "spam_alert_events"("severity", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "spam_alert_events" ADD CONSTRAINT "spam_alert_events_root_user_id_fkey" FOREIGN KEY ("root_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
