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
 * Базовый URL приложения, доступный контейнеру onlyoffice (скачивание файла и callback).
 * В Docker: http://app:3000
 */
export function getAppInternalUrlForOnlyoffice(): string {
  const u = process.env.APP_INTERNAL_URL?.trim();
  if (u && u.startsWith("http")) return u.replace(/\/+$/, "");
  const app = process.env.APP_URL?.trim();
  if (app && app.startsWith("http")) return app.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export function isOnlyofficeConfigured(): boolean {
  return !!getOnlyofficeJwtSecret() && !!getOnlyofficePublicUrl();
}
