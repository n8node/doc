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
 * Важно: не подставляем APP_URL (https://домен) по умолчанию — из Docker onlyoffice часто
 * не может сходить на свой же публичный HTTPS (hairpin NAT, DNS), из‑за этого вечный скелет
 * после onAppReady без onDocumentReady.
 *
 * Приоритет:
 * 1) ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL — явная база
 * 2) ONLYOFFICE_USE_PUBLIC_APP_URL=true + APP_URL — если осознанно гоните трафик через nginx наружу
 * 3) APP_INTERNAL_URL
 * 4) http://app:3000 — типичный сервис в docker-compose
 */
export function getOnlyofficeDocumentAndCallbackBaseUrl(): string {
  const explicit = process.env.ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL?.trim();
  if (explicit?.startsWith("http")) return explicit.replace(/\/+$/, "");

  if (process.env.ONLYOFFICE_USE_PUBLIC_APP_URL === "true") {
    const appUrl = process.env.APP_URL?.trim();
    if (appUrl?.startsWith("http")) return appUrl.replace(/\/+$/, "");
  }

  const internal = process.env.APP_INTERNAL_URL?.trim();
  if (internal?.startsWith("http")) return internal.replace(/\/+$/, "");

  return "http://app:3000";
}

/**
 * @deprecated используйте getOnlyofficeDocumentAndCallbackBaseUrl (раньше здесь был fallback на APP_URL).
 */
export function getAppInternalUrlForOnlyoffice(): string {
  return getOnlyofficeDocumentAndCallbackBaseUrl();
}

export function isOnlyofficeConfigured(): boolean {
  return !!getOnlyofficeJwtSecret() && !!getOnlyofficePublicUrl();
}
