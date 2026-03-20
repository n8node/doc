/**
 * Единая логика: поддерживаемые MIME для AI-анализа / Docling и нормализация (charset и т.д.).
 */

/** MIME без параметров, lowercased — для сравнения с наборами. */
export function normalizeMimeType(mimeType: string): string {
  const s = mimeType.trim().toLowerCase();
  const semi = s.indexOf(";");
  return semi === -1 ? s : s.slice(0, semi).trim();
}

const PROCESSABLE_BASE = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/html",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

export function isProcessableMime(mimeType: string, fileName?: string): boolean {
  const m = normalizeMimeType(mimeType);
  if (PROCESSABLE_BASE.has(m)) return true;
  const name = fileName?.trim().toLowerCase() ?? "";
  if (name.endsWith(".md") && (m === "application/octet-stream" || m === "binary/octet-stream")) {
    return true;
  }
  return false;
}

/** Markdown и plain .md обрабатываются без Docling (текст из буфера). */
export function isMarkdownFastPath(mimeType: string, fileName: string): boolean {
  const m = normalizeMimeType(mimeType);
  if (m === "text/markdown") return true;
  if (m === "text/plain" && fileName.trim().toLowerCase().endsWith(".md")) return true;
  if (
    (m === "application/octet-stream" || m === "binary/octet-stream") &&
    fileName.trim().toLowerCase().endsWith(".md")
  ) {
    return true;
  }
  return false;
}
