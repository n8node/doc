import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getEmbeddingsForCollection } from "@/lib/docling/vector-store";
import { checkRagMemoryAccess } from "@/lib/rag/access";

type Ctx = { params: Promise<{ id: string }> };

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * GET /api/v1/rag/collections/[id]/export?format=sql|supabase|qdrant
 * Export collection embeddings. Owner only.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "sql";

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
    include: { files: { select: { fileId: true } } },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const fileIds = collection.files.map((f) => f.fileId);
  const embeddings = await getEmbeddingsForCollection(id, fileIds);

  const dim = embeddings[0]?.vector?.length ?? 1536;
  const tableName = `collection_${id.replace(/-/g, "_")}_embeddings`;

  if (format === "qdrant") {
    const points = embeddings.map((e) => ({
      id: e.id,
      vector: e.vector,
      payload: {
        file_id: e.fileId,
        chunk_text: e.chunkText,
        content_hash: e.contentHash,
        chunk_index: e.chunkIndex,
        ...(e.metadata && Object.keys(e.metadata).length > 0 ? { metadata: e.metadata } : {}),
      },
    }));
    const json = JSON.stringify({ points }, null, 2);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="collection_${id}_qdrant.json"`,
      },
    });
  }

  if (format === "sql" || format === "supabase") {
    const header =
      format === "supabase"
        ? "-- Supabase (PostgreSQL + pgvector)\n-- Выполните: CREATE EXTENSION IF NOT EXISTS vector;\n\n"
        : "-- PostgreSQL + pgvector\n-- Выполните: CREATE EXTENSION IF NOT EXISTS vector;\n\n";

    let sql = header;
    sql += `CREATE EXTENSION IF NOT EXISTS vector;\n\n`;
    sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  file_id TEXT NOT NULL,\n`;
    sql += `  vector vector(${dim}) NOT NULL,\n`;
    sql += `  chunk_text TEXT NOT NULL,\n`;
    sql += `  content_hash TEXT NOT NULL,\n`;
    sql += `  chunk_index INTEGER NOT NULL,\n`;
    sql += `  metadata JSONB,\n`;
    sql += `  created_at TIMESTAMPTZ DEFAULT NOW()\n`;
    sql += `);\n\n`;

    for (const e of embeddings) {
      const vecStr = `[${e.vector.join(",")}]`;
      const metaJson = e.metadata && Object.keys(e.metadata).length > 0
        ? `'${escapeSql(JSON.stringify(e.metadata))}'::jsonb`
        : "NULL";
      sql += `INSERT INTO ${tableName} (id, file_id, vector, chunk_text, content_hash, chunk_index, metadata) VALUES (`;
      sql += `'${escapeSql(e.id)}', '${escapeSql(e.fileId)}', '${vecStr}'::vector, `;
      sql += `'${escapeSql(e.chunkText)}', '${escapeSql(e.contentHash)}', ${e.chunkIndex}, ${metaJson});\n`;
    }

    const filename = `collection_${id}_${format}.sql`;
    return new NextResponse(sql, {
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format. Use sql, supabase, or qdrant" }, { status: 400 });
}
