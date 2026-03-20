import { assertUrlAllowed } from "./ssrf";
import { extractLinks, htmlToMarkdown } from "./html-to-markdown";

const MAX_BYTES = 2_500_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; QoQonWebImport/1.0; +https://qoqon.ru) AppleWebKit/537.36";

export interface FetchPageResult {
  url: string;
  title: string | null;
  markdown: string;
  links: string[];
}

export async function fetchPageMarkdown(url: string): Promise<FetchPageResult> {
  const safe = assertUrlAllowed(url).href;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch(safe, {
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

  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const { title, markdown } = htmlToMarkdown(html, safe);
  const links = extractLinks(html, safe);

  return { url: safe, title, markdown, links };
}
