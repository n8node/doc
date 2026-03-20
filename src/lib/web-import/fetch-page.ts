import { assertUrlAllowed } from "./ssrf";
import { extractLinks, htmlToMarkdown } from "./html-to-markdown";
import { fetchHtmlForImport } from "./fetch-html";

export interface FetchPageResult {
  url: string;
  title: string | null;
  markdown: string;
  links: string[];
}

export async function fetchPageMarkdown(url: string): Promise<FetchPageResult> {
  const safe = assertUrlAllowed(url).href;
  const html = await fetchHtmlForImport(url);
  const { title, markdown } = htmlToMarkdown(html, safe);
  const links = extractLinks(html, safe);
  return { url: safe, title, markdown, links };
}
