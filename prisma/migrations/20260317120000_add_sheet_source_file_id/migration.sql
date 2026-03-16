-- AlterTable
ALTER TABLE "sheets" ADD COLUMN "source_file_id" TEXT;

-- CreateIndex
CREATE INDEX "sheets_source_file_id_idx" ON "sheets"("source_file_id");

-- AddForeignKey
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
