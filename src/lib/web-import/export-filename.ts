import type { WebImportPageRow } from "./process-job";

function hostnameFromUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = new URL(s.includes("://") ? s : `https://${s}`);
    return url.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

/**
 * Хост для имени файла: без схемы (parsing_ + этот фрагмент + .md/.json).
 * Берётся startUrl / первый URL из списка / первый URL из выбранных страниц.
 */
export function getWebImportSiteSlugForFilename(params: {
  input: unknown;
  pages: WebImportPageRow[];
}): string {
  const input = (params.input ?? {}) as Record<string, unknown>;

  if (typeof input.startUrl === "string") {
    const h = hostnameFromUrl(input.startUrl);
    if (h) return slugifySiteSegment(h);
  }

  if (Array.isArray(input.urls)) {
    for (const u of input.urls) {
      if (typeof u !== "string") continue;
      const h = hostnameFromUrl(u);
      if (h) return slugifySiteSegment(h);
    }
  }

  for (const p of params.pages) {
    if (p.url) {
      const h = hostnameFromUrl(p.url);
      if (h) return slugifySiteSegment(h);
    }
  }

  return "site";
}

function slugifySiteSegment(host: string): string {
  const s = host
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
  return s || "site";
}

export function buildParsingExportFileName(siteSlug: string, ext: "md" | "json"): string {
  return `parsing_${siteSlug}.${ext}`;
}
