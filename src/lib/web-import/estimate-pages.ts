const MAX_BATCH_HARD = 80;
const MAX_CRAWL_PAGES_HARD = 100;

/** Оценка числа страниц по входу задачи (как в process-job: batch обрезается до MAX_BATCH_HARD, crawl — maxPages с потолком). */
export function estimateWebImportPagesForJob(
  mode: string,
  input: Record<string, unknown>,
): number {
  if (mode === "single" || mode === "links_only") return 1;
  if (mode === "batch" || mode === "links_batch") {
    const urls = Array.isArray(input.urls) ? input.urls : [];
    const n = urls.filter((u) => typeof u === "string" && u.trim()).length;
    return Math.min(Math.max(0, n), MAX_BATCH_HARD);
  }
  if (mode === "crawl") {
    const maxPagesRaw = Number(input.maxPages);
    return Math.min(
      MAX_CRAWL_PAGES_HARD,
      Math.max(1, Number.isFinite(maxPagesRaw) ? maxPagesRaw : 30),
    );
  }
  return 1;
}
