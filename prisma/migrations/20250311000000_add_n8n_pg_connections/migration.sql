-- CreateTable
CREATE TABLE "n8n_pg_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "db_role_name" TEXT NOT NULL,
    "db_password_hash" TEXT NOT NULL,
    "view_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_pg_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "n8n_pg_connections_db_role_name_key" ON "n8n_pg_connections"("db_role_name");

-- CreateIndex
CREATE INDEX "n8n_pg_connections_user_id_idx" ON "n8n_pg_connections"("user_id");

-- CreateIndex
CREATE INDEX "n8n_pg_connections_collection_id_idx" ON "n8n_pg_connections"("collection_id");

-- AddForeignKey
ALTER TABLE "n8n_pg_connections" ADD CONSTRAINT "n8n_pg_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_pg_connections" ADD CONSTRAINT "n8n_pg_connections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "vector_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
