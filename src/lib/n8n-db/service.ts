import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { createN8nDbClient } from "./client";
import type { N8nDbTarget } from "./client";
import type { EmbeddingForExport } from "@/lib/docling/vector-store";

const ROLE_PREFIX = "n8n_conn_";
const VIEW_PREFIX = "coll_";
const SCHEMA_NAME = "n8n";

function sanitizeIdent(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
}

export interface CreateN8nConnectionResult {
  connectionId: string;
  dbRoleName: string;
  dbPassword: string;
  viewName: string;
}

export interface N8nConnectionInfo {
  id: string;
  dbRoleName: string;
  viewName: string;
  createdAt: string;
}

/**
 * Create n8n PostgreSQL connection: schema, table, role, sync data.
 */
export async function createN8nConnection(
  connectionId: string,
  collectionId: string,
  embeddings: EmbeddingForExport[],
  target: N8nDbTarget = "DEFAULT"
): Promise<CreateN8nConnectionResult> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }

  const shortId = sanitizeIdent(connectionId.slice(-12));
  const dbRoleName = `${ROLE_PREFIX}${shortId}`;
  const viewName = `${VIEW_PREFIX}${shortId}`;
  const password = randomBytes(24).toString("base64url");

  await client.connect();

  try {
    // Ensure pgvector
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    // Ensure schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
    // Create role (PostgreSQL does not support $1 in PASSWORD clause)
    const escapedPwd = password.replace(/'/g, "''");
    await client.query(`CREATE ROLE "${dbRoleName}" WITH LOGIN PASSWORD '${escapedPwd}'`);
    await client.query(`ALTER ROLE "${dbRoleName}" SET search_path = '${SCHEMA_NAME}'`);
    // n8n PGVector Store node runs CREATE TABLE IF NOT EXISTS / CREATE INDEX
    // on init, so the role needs USAGE + CREATE on the schema.
    await client.query(`GRANT USAGE, CREATE ON SCHEMA ${SCHEMA_NAME} TO "${dbRoleName}"`);

    const tableName = `${SCHEMA_NAME}.${viewName}`;
    const dim = embeddings[0]?.vector?.length ?? 1536;

    // Create table — column named "embedding" to match LangChain/n8n PGVector Store expectations
    await client.query(`
      CREATE TABLE ${tableName} (
        id TEXT PRIMARY KEY,
        embedding vector(${dim}) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'
      )
    `);

    // Insert embeddings
    if (embeddings.length > 0) {
      for (const e of embeddings) {
        const vecStr = `[${e.vector.join(",")}]`;
        const metaJson = e.metadata && Object.keys(e.metadata).length > 0
          ? JSON.stringify(e.metadata)
          : "{}";
        await client.query(
          `INSERT INTO ${tableName} (id, embedding, content, metadata) VALUES ($1, $2::vector, $3, $4::jsonb)`,
          [e.id, vecStr, e.chunkText, metaJson]
        );
      }
    }

    // Grant full access on the table so PGVector Store can SELECT, INSERT,
    // create indexes, etc.
    await client.query(`GRANT ALL ON ${tableName} TO "${dbRoleName}"`);

    return { connectionId, dbRoleName, dbPassword: password, viewName };
  } finally {
    await client.end();
  }
}

/**
 * Revoke n8n connection: drop role, drop table.
 */
export async function revokeN8nConnection(
  dbRoleName: string,
  viewName: string,
  target: N8nDbTarget = "DEFAULT"
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }

  await client.connect();

  try {
    const tableName = `${SCHEMA_NAME}.${viewName}`;
    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
    await client.query(`DROP ROLE IF EXISTS "${dbRoleName}"`);
  } finally {
    await client.end();
  }
}

/**
 * Sync/refresh embeddings to existing n8n table.
 */
export async function syncN8nConnection(
  viewName: string,
  embeddings: EmbeddingForExport[],
  target: N8nDbTarget = "DEFAULT"
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }

  await client.connect();

  try {
    const tableName = `${SCHEMA_NAME}.${viewName}`;

    await client.query(`TRUNCATE TABLE ${tableName}`);

    if (embeddings.length > 0) {
      for (const e of embeddings) {
        const vecStr = `[${e.vector.join(",")}]`;
        const metaJson = e.metadata && Object.keys(e.metadata).length > 0
          ? JSON.stringify(e.metadata)
          : "{}";
        await client.query(
          `INSERT INTO ${tableName} (id, embedding, content, metadata) VALUES ($1, $2::vector, $3, $4::jsonb)`,
          [e.id, vecStr, e.chunkText, metaJson]
        );
      }
    }
  } finally {
    await client.end();
  }
}

/**
 * Upgrade permissions for an existing n8n role to match what PGVector Store needs.
 * Safe to call multiple times (GRANT is idempotent in PostgreSQL).
 */
export async function upgradeN8nConnectionPermissions(
  dbRoleName: string,
  viewName: string,
  target: N8nDbTarget = "DEFAULT",
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) return;

  await client.connect();
  try {
    const tableName = `${SCHEMA_NAME}.${viewName}`;
    await client.query(`GRANT USAGE, CREATE ON SCHEMA ${SCHEMA_NAME} TO "${dbRoleName}"`);
    await client.query(`GRANT ALL ON ${tableName} TO "${dbRoleName}"`);
  } finally {
    await client.end();
  }
}

export async function hashN8nPassword(password: string): Promise<string> {
  return hash(password, 12);
}
