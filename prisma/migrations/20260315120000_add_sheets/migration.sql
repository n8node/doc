-- CreateTable
CREATE TABLE "sheets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_columns" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'text',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_cells" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "column_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_cells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheets_user_id_idx" ON "sheets"("user_id");

-- CreateIndex
CREATE INDEX "sheet_columns_sheet_id_idx" ON "sheet_columns"("sheet_id");

-- CreateIndex
CREATE INDEX "sheet_cells_sheet_id_idx" ON "sheet_cells"("sheet_id");

-- CreateIndex
CREATE INDEX "sheet_cells_column_id_idx" ON "sheet_cells"("column_id");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_cells_sheet_id_column_id_row_index_key" ON "sheet_cells"("sheet_id", "column_id", "row_index");

-- AddForeignKey
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_columns" ADD CONSTRAINT "sheet_columns_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_cells" ADD CONSTRAINT "sheet_cells_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_cells" ADD CONSTRAINT "sheet_cells_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "sheet_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
