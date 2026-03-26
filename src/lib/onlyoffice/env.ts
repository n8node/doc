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
 * Приоритет:
 * 1) ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL — явная настройка (например http://app:3000 без hairpin).
 * 2) Публичный https://APP_URL или NEXTAUTH_URL — DS качает через тот же nginx, что и браузер (часто
 *    решает случай, когда DS не ходит на http://app:3000 при том, что wget из контейнера работает).
 * 3) APP_INTERNAL_URL
 * 4) localhost для dev
 * 5) http://app:3000
 */
export function getOnlyofficeDocumentAndCallbackBaseUrl(): string {
  const explicit = process.env.ONLYOFFICE_DOCUMENT_DOWNLOAD_BASE_URL?.trim();
  if (explicit?.startsWith("http")) return explicit.replace(/\/+$/, "");

  const publicHttps = pickPublicHttpsAppBaseUrl();
  if (publicHttps) return publicHttps;

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

function pickPublicHttpsAppBaseUrl(): string | null {
  const candidates = [
    process.env.APP_URL?.trim(),
    process.env.NEXTAUTH_URL?.trim(),
  ];
  for (const u of candidates) {
    if (
      u?.startsWith("https://") &&
      !u.includes("localhost") &&
      !u.includes("127.0.0.1")
    ) {
      return u.replace(/\/+$/, "");
    }
  }
  return null;
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
