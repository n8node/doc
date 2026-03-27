const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** День + суффикс («15-ое», «3-ье») + месяц и год по-русски */
export function formatRoadmapDateRu(isoDate: Date | string): string {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const d10 = day % 10;
  const d100 = day % 100;
  const suffix = d10 === 3 && d100 !== 13 ? "ье" : "ое";
  return `${day}-${suffix} ${MONTHS_RU[month]} ${year}`;
}

/** Значение для input type="date" (UTC-календарная дата) */
export function toIsoDateInput(isoDate: Date | string): string {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Миллисекунды UTC-полуночи для календарного дня (без сдвига из-за времени в ISO).
 * Используется для сортировки этапов дорожной карты.
 */
export function roadmapUtcCalendarDayMs(isoDate: string | Date): number {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return 0;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Парсинг YYYY-MM-DD в Date UTC полночь */
export function parseIsoDateInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, day));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== day) return null;
  return dt;
}
