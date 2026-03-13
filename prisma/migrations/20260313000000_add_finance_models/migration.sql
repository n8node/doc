-- CreateTable: партии пополнения OpenRouter
CREATE TABLE "open_router_topup_batches" (
    "id" TEXT NOT NULL,
    "usd_amount" DOUBLE PRECISION NOT NULL,
    "rub_spent_cents" INTEGER NOT NULL,
    "rub_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "effective_rate_rub_per_usd" DOUBLE PRECISION NOT NULL,
    "usd_remaining" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "comment" TEXT,
    "topped_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_router_topup_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "open_router_topup_batches_topped_at_idx" ON "open_router_topup_batches"("topped_at" DESC);

-- CreateTable: операционные расходы платформы
CREATE TABLE "platform_expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "unit" TEXT,
    "since_at" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_expenses_category_idx" ON "platform_expenses"("category");
CREATE INDEX "platform_expenses_since_at_idx" ON "platform_expenses"("since_at" DESC);
