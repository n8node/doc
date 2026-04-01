-- CreateTable
CREATE TABLE "robokassa_serial" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robokassa_serial_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "payment_provider" TEXT,
ADD COLUMN "robokassa_inv_id" INTEGER;

-- AlterTable
ALTER TABLE "llm_wallet_topups" ADD COLUMN "payment_provider" TEXT,
ADD COLUMN "robokassa_inv_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "payments_robokassa_inv_id_key" ON "payments"("robokassa_inv_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_wallet_topups_robokassa_inv_id_key" ON "llm_wallet_topups"("robokassa_inv_id");

UPDATE "payments" SET "payment_provider" = 'yookassa' WHERE "yookassa_payment_id" IS NOT NULL;
UPDATE "llm_wallet_topups" SET "payment_provider" = 'yookassa' WHERE "yookassa_payment_id" IS NOT NULL;
