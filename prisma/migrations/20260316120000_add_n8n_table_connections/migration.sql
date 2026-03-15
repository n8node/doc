-- CreateTable
CREATE TABLE "n8n_table_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "db_role_name" TEXT NOT NULL,
    "db_password_hash" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'DEFAULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_table_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "n8n_table_connections_db_role_name_key" ON "n8n_table_connections"("db_role_name");

-- CreateIndex
CREATE INDEX "n8n_table_connections_user_id_idx" ON "n8n_table_connections"("user_id");

-- CreateIndex
CREATE INDEX "n8n_table_connections_sheet_id_idx" ON "n8n_table_connections"("sheet_id");

-- AddForeignKey
ALTER TABLE "n8n_table_connections" ADD CONSTRAINT "n8n_table_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_table_connections" ADD CONSTRAINT "n8n_table_connections_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
