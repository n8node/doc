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
