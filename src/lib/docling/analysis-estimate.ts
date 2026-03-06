/**
 * Оценка времени анализа документа (Docling: OCR, извлечение текста, таблицы).
 * Формула: baseSeconds + sizeMB * factorPerMB в зависимости от формата.
 */

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MSWORD_MIME = "application/msword";

/** PDF: OCR, таблицы — самый тяжёлый */
const PDF_BASE = 8;
const PDF_FACTOR = 12;

/** DOCX, PPTX, XLSX: структурированные форматы */
const OFFICE_BASE = 4;
const OFFICE_FACTOR = 6;

/** MS Word legacy */
const MSWORD_BASE = 5;
const MSWORD_FACTOR = 8;

/** TXT, CSV, MD, HTML: простой парсинг */
const TEXT_BASE = 2;
const TEXT_FACTOR = 3;

const MIN_SECONDS = 5;
const MAX_SECONDS = 300;

export interface AnalysisTimeEstimate {
  estimatedProcessingSeconds: number;
  estimatedProcessingMinutes: number;
  sizeBytes: number;
  format: "pdf" | "office" | "msword" | "text";
}

/**
 * Оценка времени анализа документа по размеру и формату.
 */
export function estimateAnalysisTime(
  sizeBytes: number | bigint,
  mimeType: string
): AnalysisTimeEstimate {
  const bytes = typeof sizeBytes === "bigint" ? Number(sizeBytes) : Math.max(0, sizeBytes);
  const sizeMb = bytes / (1024 * 1024);

  let base: number;
  let factor: number;
  let format: AnalysisTimeEstimate["format"];

  if (mimeType === PDF_MIME) {
    base = PDF_BASE;
    factor = PDF_FACTOR;
    format = "pdf";
  } else if (
    mimeType === DOCX_MIME ||
    mimeType === PPTX_MIME ||
    mimeType === XLSX_MIME
  ) {
    base = OFFICE_BASE;
    factor = OFFICE_FACTOR;
    format = "office";
  } else if (mimeType === MSWORD_MIME) {
    base = MSWORD_BASE;
    factor = MSWORD_FACTOR;
    format = "msword";
  } else {
    base = TEXT_BASE;
    factor = TEXT_FACTOR;
    format = "text";
  }

  const rawSec = base + sizeMb * factor;
  const estimatedSec = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, Math.ceil(rawSec)));
  const estimatedMin = Math.max(1, Math.ceil(estimatedSec / 60));

  return {
    estimatedProcessingSeconds: estimatedSec,
    estimatedProcessingMinutes: estimatedMin,
    sizeBytes: bytes,
    format,
  };
}
