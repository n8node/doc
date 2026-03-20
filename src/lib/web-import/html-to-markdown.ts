import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export interface ExtractedPage {
  title: string | null;
  markdown: string;
}

/**
 * Удаляем скрипты/стили и берём article > main > body.
 */
export function htmlToMarkdown(html: string, _baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer, header").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;

  let fragment =
    $("article").first().html() ||
    $("main").first().html() ||
    $('[role="main"]').first().html() ||
    $(".content, .post, .entry-content").first().html() ||
    $("body").html() ||
    "";

  fragment = fragment.trim();
  if (!fragment) {
    return { title, markdown: "" };
  }

  const markdown = turndown.turndown(fragment).trim();
  return { title: title || null, markdown };
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
    try {
      const abs = new URL(href, baseUrl).href;
      const u = new URL(abs);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      u.hash = "";
      const key = u.href;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(key);
    } catch {
      /* skip */
    }
  });

  return out;
}
