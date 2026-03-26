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
 * Приоритет: ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL → APP_INTERNAL_URL → localhost dev → http://app:3000
 * В docker-compose задано по умолчанию http://app:3000 (не внешний https — избегаем hairpin).
 */
export function getOnlyofficeDocumentAndCallbackBaseUrl(): string {
  const explicit = process.env.ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL?.trim();
  if (explicit?.startsWith("http")) return explicit.replace(/\/+$/, "");

  const internal = process.env.APP_INTERNAL_URL?.trim();
  if (internal?.startsWith("http")) return internal.replace(/\/+$/, "");

  const appUrl = process.env.APP_URL?.trim();
  if (
    appUrl?.startsWith("http://localhost") ||
    appUrl?.startsWith("http://127.0.0.1")
  ) {
    return appUrl.replace(/\/+$/, "");
  }

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
