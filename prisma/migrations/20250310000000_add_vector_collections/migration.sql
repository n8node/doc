-- CreateTable
CREATE TABLE "vector_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vector_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_collection_files" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vector_collection_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vector_collections_user_id_idx" ON "vector_collections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vector_collection_files_collection_id_file_id_key" ON "vector_collection_files"("collection_id", "file_id");

-- CreateIndex
CREATE INDEX "vector_collection_files_collection_id_idx" ON "vector_collection_files"("collection_id");

-- CreateIndex
CREATE INDEX "vector_collection_files_file_id_idx" ON "vector_collection_files"("file_id");

-- AddForeignKey
ALTER TABLE "vector_collections" ADD CONSTRAINT "vector_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vector_collections" ADD CONSTRAINT "vector_collections_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vector_collection_files" ADD CONSTRAINT "vector_collection_files_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "vector_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vector_collection_files" ADD CONSTRAINT "vector_collection_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
