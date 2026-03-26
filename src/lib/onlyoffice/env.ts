export function getOnlyofficeJwtSecret(): string | null {
  const s = process.env.ONLYOFFICE_JWT_SECRET?.trim();
  return s && s.length >= 8 ? s : null;
}

/** Публичный URL Document Server (скрипт api.js, iframe). Отдаётся клиенту из API — NEXT_PUBLIC не обязателен. */
export function getOnlyofficePublicUrl(): string | null {
  const u =
    process.env.ONLYOFFICE_DOCUMENT_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_ONLYOFFICE_URL?.trim();
  return u && u.startsWith("http") ? u.replace(/\/+$/, "") : null;
}

/**
 * База URL для document.url и callbackUrl в JWT (должна быть достижима из контейнера onlyoffice).
 *
 * По умолчанию для продакшена: APP_URL с https (nginx → app) — так обычно интегрируют ONLYOFFICE.
 * Внутренний http://app:3000 включайте через ONLYOFFICE_USE_INTERNAL_DOCUMENT_URL=true, если
 * публичный URL из Docker недоступен (hairpin) или отлаживаете сеть.
 */
export function getOnlyofficeDocumentAndCallbackBaseUrl(): string {
  const explicit = process.env.ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL?.trim();
  if (explicit?.startsWith("http")) return explicit.replace(/\/+$/, "");

  if (process.env.ONLYOFFICE_USE_INTERNAL_DOCUMENT_URL === "true") {
    const internal = process.env.APP_INTERNAL_URL?.trim();
    if (internal?.startsWith("http")) return internal.replace(/\/+$/, "");
    return "http://app:3000";
  }

  if (process.env.ONLYOFFICE_USE_PUBLIC_APP_URL === "true") {
    const appUrl = process.env.APP_URL?.trim();
    if (appUrl?.startsWith("http")) return appUrl.replace(/\/+$/, "");
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl?.startsWith("https://")) return appUrl.replace(/\/+$/, "");
  if (
    appUrl?.startsWith("http://localhost") ||
    appUrl?.startsWith("http://127.0.0.1")
  ) {
    return appUrl.replace(/\/+$/, "");
  }

  const internal = process.env.APP_INTERNAL_URL?.trim();
  if (internal?.startsWith("http")) return internal.replace(/\/+$/, "");

  return "http://app:3000";
}

/**
 * @deprecated используйте getOnlyofficeDocumentAndCallbackBaseUrl
 */
export function getAppInternalUrlForOnlyoffice(): string {
  return getOnlyofficeDocumentAndCallbackBaseUrl();
}

export function isOnlyofficeConfigured(): boolean {
  return !!getOnlyofficeJwtSecret() && !!getOnlyofficePublicUrl();
}
