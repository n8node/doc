/** Яндекс.Почта: IMAP/SMTP с паролем приложения */
export const YANDEX_IMAP_HOST = "imap.yandex.ru";
export const YANDEX_IMAP_PORT = 993;
export const YANDEX_SMTP_HOST = "smtp.yandex.ru";
export const YANDEX_SMTP_PORT = 465;

export const DEFAULT_FOLDER = "INBOX";

/** Максимум символов текста письма в кэше БД */
export const BODY_TEXT_MAX_LEN = 100_000;

/** За один проход синка не обрабатывать больше писем (защита от таймаута) */
export const SYNC_MAX_MESSAGES_PER_RUN = 800;
