import { assertUrlAllowed } from "./ssrf";
import { htmlToMarkdown } from "./html-to-markdown";
import { fetchRenderedHtml } from "./playwright-render";

const MAX_BYTES = 2_500_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; QoQonWebImport/1.0; +https://qoqon.ru) AppleWebKit/537.36";

/** Ниже этого порога считаем, что статического HTML недостаточно — пробуем Playwright. */
const MIN_MARKDOWN_CHARS = 80;

function isPlaywrightEnabled(): boolean {
  return process.env.WEB_IMPORT_PLAYWRIGHT !== "0";
}

async function fetchHtmlPlain(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
      },
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new Error(`Не HTML-ответ (${ct || "нет Content-Type"})`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("Страница слишком большая");
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function needsRenderedHtml(html: string, pageUrl: string): boolean {
  const { markdown } = htmlToMarkdown(html, pageUrl);
  return markdown.trim().length < MIN_MARKDOWN_CHARS;
}

/**
 * Загружает HTML: сначала обычный fetch, при «пустом» контенте (SPA / оболочка) — Chromium через Playwright.
 */
export async function fetchHtmlForImport(rawUrl: string): Promise<string> {
  const safe = assertUrlAllowed(rawUrl).href;
  const plain = await fetchHtmlPlain(safe);

  if (!needsRenderedHtml(plain, safe)) {
    return plain;
  }

  if (!isPlaywrightEnabled()) {
    return plain;
  }

  try {
    const rendered = await fetchRenderedHtml(safe, MAX_BYTES);
    if (!needsRenderedHtml(rendered, safe)) {
      return rendered;
    }
    return rendered.length >= plain.length ? rendered : plain;
  } catch {
    return plain;
  }
}
