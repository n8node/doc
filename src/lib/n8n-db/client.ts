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

/**
 * Returns connection params for n8n (public host/port for external connections).
 * Uses N8N_DB_PUBLIC_HOST and N8N_DB_PUBLIC_PORT when set, otherwise APP_URL host + port 5433.
 */
export function getN8nDbConnectionParams(): N8nDbConnectionParams | null {
  const url = getN8nDbUrl();
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^postgres:/, "postgresql:"));
    let publicHost = process.env.N8N_DB_PUBLIC_HOST;
    if (!publicHost && process.env.APP_URL?.trim()) {
      try {
        const appUrl = process.env.APP_URL.trim();
        publicHost = new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).hostname;
      } catch {
        publicHost = null;
      }
    }
    publicHost = publicHost || u.hostname;
    const publicPort = process.env.N8N_DB_PUBLIC_PORT
      ? parseInt(process.env.N8N_DB_PUBLIC_PORT, 10)
      : 5433;
    return {
      host: publicHost,
      port: publicPort,
      database: u.pathname?.slice(1) || "postgres",
      ssl: u.searchParams.get("sslmode") === "require",
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
    const sslMode = u.searchParams.get("sslmode");
    const useSsl = sslMode !== "disable" && sslMode !== null;
    const client = new Client({
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: u.pathname?.slice(1)?.replace(/^\//, "") || "postgres",
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    return client;
  } catch {
    return null;
  }
}
