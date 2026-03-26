/**
 * База для `metadata` (icons, OG): Next без неё может собрать URL из HOSTNAME=0.0.0.0 в Docker
 * → `http://0.0.0.0:3000/...` в head, ERR_ADDRESS_INVALID и ошибки гидратации React (#418/#423).
 */
export function getMetadataBaseUrl(): string {
  const raw = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (raw.startsWith("http")) {
    try {
      const u = new URL(raw);
      if (u.hostname === "0.0.0.0" || u.hostname === "[::]") {
        return "https://qoqon.ru";
      }
      return raw;
    } catch {
      /* fall through */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return "https://qoqon.ru";
}

/**
 * Public base URL for the app (no trailing slash).
 * Used for share links, auth redirects, etc.
 * Prefers APP_URL/NEXTAUTH_URL when not localhost; otherwise fallback.
 */
export function getPublicBaseUrl(): string {
  const fromEnv = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").trim();
  if (fromEnv && !fromEnv.includes("localhost")) return fromEnv.replace(/\/$/, "");
  return "https://qoqon.ru";
}

/**
 * База для OAuth callback — совпадает с тем, как NextAuth строит redirect_uri (NEXTAUTH_URL).
 * Не путать с getPublicBaseUrl(), где APP_URL может иметь приоритет.
 */
export function getNextAuthBaseUrl(): string {
  const fromNextAuth = (process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (fromNextAuth && !fromNextAuth.includes("localhost")) return fromNextAuth;
  return getPublicBaseUrl();
}

/**
 * Cookie для oauth-prep (режим VK): общий registrable domain, чтобы работало и с www, и без;
 * secure по схеме NEXTAUTH_URL, не только по NODE_ENV.
 */
export function getOAuthCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
  domain?: string;
} {
  const base = getNextAuthBaseUrl();
  let secure = false;
  let domain: string | undefined;
  try {
    const u = new URL(base.startsWith("http") ? base : `https://${base}`);
    secure = u.protocol === "https:";
    const host = u.hostname;
    if (host !== "localhost" && !host.startsWith("127.")) {
      domain = host.startsWith("www.") ? host.slice(4) : host;
    }
  } catch {
    secure = process.env.NODE_ENV === "production";
  }
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure,
    ...(domain ? { domain } : {}),
  };
}
