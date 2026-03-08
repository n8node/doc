import { Client } from "pg";

const N8N_DB_URL = process.env.N8N_DB_URL;

export function getN8nDbUrl(): string | null {
  return N8N_DB_URL && N8N_DB_URL.trim().length > 0 ? N8N_DB_URL.trim() : null;
}

export function isN8nDbEnabled(): boolean {
  return !!getN8nDbUrl();
}

export interface N8nDbConnectionParams {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

export function getN8nDbConnectionParams(): N8nDbConnectionParams | null {
  const url = getN8nDbUrl();
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^postgres:/, "postgresql:"));
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: u.pathname?.slice(1) || "postgres",
      ssl: u.searchParams.get("sslmode") !== "disable",
    };
  } catch {
    return null;
  }
}

/**
 * Create a pg Client for n8n_db. Caller must call client.end() when done.
 * Returns null if N8N_DB_URL is not configured.
 */
export function createN8nDbClient(): Client | null {
  const url = getN8nDbUrl();
  if (!url) return null;

  try {
    const u = new URL(url.replace(/^postgres:/, "postgresql:"));
    const client = new Client({
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: u.pathname?.slice(1)?.replace(/^\//, "") || "postgres",
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: {
        rejectUnauthorized: false,
      },
    });
    return client;
  } catch {
    return null;
  }
}
