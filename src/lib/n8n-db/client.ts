import { Client } from "pg";

/** Максимум n8n-подключений на одну таблицу или одну RAG-коллекцию */
export const MAX_N8N_CONNECTIONS_PER_ENTITY = 3;

export type N8nDbTarget = "DEFAULT" | "RF";

function normalizeTarget(target: N8nDbTarget | string | undefined): N8nDbTarget {
  return target === "RF" ? "RF" : "DEFAULT";
}

export function getN8nDbUrl(target: N8nDbTarget = "DEFAULT"): string | null {
  const t = normalizeTarget(target);
  const raw = t === "RF" ? process.env.N8N_DB_URL_RF : process.env.N8N_DB_URL;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

export function isN8nDbEnabled(target: N8nDbTarget = "DEFAULT"): boolean {
  return !!getN8nDbUrl(target);
}

export function getN8nDbTargetsStatus(): Record<N8nDbTarget, boolean> {
  return {
    DEFAULT: isN8nDbEnabled("DEFAULT"),
    RF: isN8nDbEnabled("RF"),
  };
}

export function isN8nDbTarget(value: string): value is N8nDbTarget {
  return value === "DEFAULT" || value === "RF";
}

export interface N8nDbConnectionParams {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

/**
 * Returns connection params for n8n (public host/port for external connections).
 * Uses target-specific public host/port variables when set.
 */
export function getN8nDbConnectionParams(target: N8nDbTarget = "DEFAULT"): N8nDbConnectionParams | null {
  const t = normalizeTarget(target);
  const url = getN8nDbUrl(t);
  if (!url) return null;

  try {
    const u = new URL(url.replace(/^postgres:/, "postgresql:"));

    let publicHost: string | undefined;
    let publicPort: number;

    if (t === "RF") {
      publicHost = process.env.N8N_DB_PUBLIC_HOST_RF || undefined;
      publicPort = process.env.N8N_DB_PUBLIC_PORT_RF
        ? parseInt(process.env.N8N_DB_PUBLIC_PORT_RF, 10)
        : (u.port ? parseInt(u.port, 10) : 5432);
    } else {
      publicHost = process.env.N8N_DB_PUBLIC_HOST || undefined;
      if (!publicHost && process.env.APP_URL?.trim()) {
        try {
          const appUrl = process.env.APP_URL.trim();
          publicHost = new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).hostname;
        } catch {
          publicHost = undefined;
        }
      }
      publicPort = process.env.N8N_DB_PUBLIC_PORT
        ? parseInt(process.env.N8N_DB_PUBLIC_PORT, 10)
        : 5433;
    }

    publicHost = publicHost || u.hostname;
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
 * Returns null if target DB URL is not configured.
 */
export function createN8nDbClient(target: N8nDbTarget = "DEFAULT"): Client | null {
  const t = normalizeTarget(target);
  const url = getN8nDbUrl(t);
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
