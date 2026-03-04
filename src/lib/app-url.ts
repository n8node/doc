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
