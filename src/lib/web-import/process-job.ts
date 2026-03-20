import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPageMarkdown } from "./fetch-page";
import { extractLinks } from "./html-to-markdown";
import { assertUrlAllowed, normalizeHttpUrl } from "./ssrf";

const MAX_CRAWL_PAGES_HARD = 100;
const MAX_BATCH_HARD = 80;
const MAX_QUEUE = 1500;

export type WebImportPageRow = {
  id: string;
  url: string;
  title: string | null;
  markdown: string | null;
  status: "pending" | "fetching" | "done" | "error";
  error?: string;
  /** Только для режима links_only */
  links?: string[];
};

type CrawlState = {
  queue: string[];
  visited: string[];
  originHost: string;
  maxPages: number;
};

type BatchState = {
  urls: string[];
  index: number;
};

async function fetchHtmlOnly(url: string): Promise<string> {
  const safe = assertUrlAllowed(url).href;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(safe, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; QoQonWebImport/1.0) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 2_500_000) throw new Error("Страница слишком большая");
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Один шаг обработки (одна загрузка страницы за вызов, кроме links_only — тоже одна).
 */
export async function processWebImportStep(jobId: string): Promise<void> {
  const job = await prisma.webImportJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.cancelRequested) {
    await prisma.webImportJob.update({
      where: { id: jobId },
      data: { status: "cancelled" },
    });
    return;
  }

  if (job.status === "completed" || job.status === "cancelled" || job.status === "failed") {
    return;
  }

  await prisma.webImportJob.update({
    where: { id: jobId },
    data: { status: "running" },
  });

  const pages = job.pages as unknown as WebImportPageRow[];
  const input = job.input as Record<string, unknown>;
  const mode = job.mode;

  try {
    if (mode === "links_only") {
      const startUrl = typeof input.startUrl === "string" ? input.startUrl : "";
      const u = normalizeHttpUrl(startUrl);
      const html = await fetchHtmlOnly(u);
      const links = extractLinks(html, u);
      const md =
        `# Ссылки\n\nИсточник: ${u}\n\n` +
        links.map((l) => `- ${l}`).join("\n");
      const row: WebImportPageRow = {
        id: nanoid(12),
        url: u,
        title: "Список ссылок",
        markdown: md,
        status: "done",
        links,
      };
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: [row] as unknown as object[],
          status: "completed",
          state: Prisma.JsonNull,
        },
      });
      return;
    }

    if (mode === "single") {
      const startUrl = typeof input.startUrl === "string" ? input.startUrl : "";
      const u = normalizeHttpUrl(startUrl);
      const row: WebImportPageRow = {
        id: nanoid(12),
        url: u,
        title: null,
        markdown: null,
        status: "fetching",
      };
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: { pages: [row] as unknown as object[] },
      });
      try {
        const r = await fetchPageMarkdown(u);
        row.title = r.title;
        row.markdown = r.markdown;
        row.status = "done";
      } catch (e) {
        row.status = "error";
        row.error = e instanceof Error ? e.message : String(e);
      }
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: [row] as unknown as object[],
          status: "completed",
        },
      });
      return;
    }

    if (mode === "batch") {
      let state = job.state as unknown as BatchState | null;
      if (!state || !Array.isArray(state.urls)) {
        const raw = Array.isArray(input.urls) ? input.urls : [];
        const urls: string[] = [];
        for (const x of raw) {
          if (typeof x !== "string") continue;
          try {
            urls.push(normalizeHttpUrl(x));
          } catch {
            /* skip bad */
          }
        }
        state = { urls: urls.slice(0, MAX_BATCH_HARD), index: 0 };
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { state: state as object, pages: [] },
        });
      }

      if (job.cancelRequested) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "cancelled" },
        });
        return;
      }

      const idx = state.index;
      if (idx >= state.urls.length) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "completed" },
        });
        return;
      }

      const u = state.urls[idx];
      const row: WebImportPageRow = {
        id: nanoid(12),
        url: u,
        title: null,
        markdown: null,
        status: "fetching",
      };
      const nextPages = [...pages, row];
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: nextPages as unknown as object[],
          state: { ...state, index: idx + 1 } as object,
        },
      });

      try {
        const r = await fetchPageMarkdown(u);
        row.title = r.title;
        row.markdown = r.markdown;
        row.status = "done";
      } catch (e) {
        row.status = "error";
        row.error = e instanceof Error ? e.message : String(e);
      }

      const updated = nextPages.map((p) => (p.id === row.id ? row : p));
      const done = idx + 1 >= state.urls.length;
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: updated as unknown as object[],
          status: done ? "completed" : "running",
        },
      });
      return;
    }

    if (mode === "links_batch") {
      let state = job.state as unknown as BatchState | null;
      if (!state || !Array.isArray(state.urls)) {
        const raw = Array.isArray(input.urls) ? input.urls : [];
        const urls: string[] = [];
        for (const x of raw) {
          if (typeof x !== "string") continue;
          try {
            urls.push(normalizeHttpUrl(x));
          } catch {
            /* skip bad */
          }
        }
        const trimmed = urls.slice(0, MAX_BATCH_HARD);
        if (trimmed.length === 0) {
          await prisma.webImportJob.update({
            where: { id: jobId },
            data: {
              status: "failed",
              errorMessage: "Нет корректных URL для списка ссылок",
            },
          });
          return;
        }
        state = { urls: trimmed, index: 0 };
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { state: state as object, pages: [] },
        });
      }

      if (job.cancelRequested) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "cancelled" },
        });
        return;
      }

      const idx = state.index;
      if (idx >= state.urls.length) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "completed" },
        });
        return;
      }

      const u = state.urls[idx];
      const row: WebImportPageRow = {
        id: nanoid(12),
        url: u,
        title: "Список ссылок",
        markdown: null,
        status: "fetching",
      };
      const nextPages = [...pages, row];
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: nextPages as unknown as object[],
          state: { ...state, index: idx + 1 } as object,
        },
      });

      try {
        const html = await fetchHtmlOnly(u);
        const links = extractLinks(html, u);
        const md =
          `# Ссылки\n\nИсточник: ${u}\n\n` + links.map((l) => `- ${l}`).join("\n");
        row.markdown = md;
        row.status = "done";
        row.links = links;
      } catch (e) {
        row.status = "error";
        row.error = e instanceof Error ? e.message : String(e);
      }

      const updated = nextPages.map((p) => (p.id === row.id ? row : p));
      const done = idx + 1 >= state.urls.length;
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: updated as unknown as object[],
          status: done ? "completed" : "running",
        },
      });
      return;
    }

    if (mode === "crawl") {
      let state = job.state as unknown as CrawlState | null;
      const startUrl = typeof input.startUrl === "string" ? input.startUrl : "";
      const maxPagesRaw = Number(input.maxPages);
      const maxPages = Math.min(
        MAX_CRAWL_PAGES_HARD,
        Math.max(1, Number.isFinite(maxPagesRaw) ? maxPagesRaw : 30),
      );

      if (!state) {
        const u = normalizeHttpUrl(startUrl);
        const originHost = new URL(u).hostname.toLowerCase();
        state = {
          queue: [u],
          visited: [],
          originHost,
          maxPages,
        };
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { state: state as object, pages: [] },
        });
      }

      if (job.cancelRequested) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "cancelled" },
        });
        return;
      }

      const doneCount = pages.filter((p) => p.status === "done" || p.status === "error").length;
      if (doneCount >= state.maxPages || state.queue.length === 0) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "completed" },
        });
        return;
      }

      let nextUrl: string | undefined;
      while (state.queue.length > 0) {
        const candidate = state.queue.shift()!;
        let norm: string;
        try {
          norm = normalizeHttpUrl(candidate);
        } catch {
          continue;
        }
        if (new URL(norm).hostname.toLowerCase() !== state.originHost) continue;
        if (state.visited.includes(norm)) continue;
        nextUrl = norm;
        break;
      }

      if (!nextUrl) {
        await prisma.webImportJob.update({
          where: { id: jobId },
          data: { status: "completed", state: state as object },
        });
        return;
      }

      state.visited.push(nextUrl);

      const row: WebImportPageRow = {
        id: nanoid(12),
        url: nextUrl,
        title: null,
        markdown: null,
        status: "fetching",
      };
      const nextPages = [...pages, row];
      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: nextPages as unknown as object[],
          state: state as object,
        },
      });

      try {
        const r = await fetchPageMarkdown(nextUrl);
        row.title = r.title;
        row.markdown = r.markdown;
        row.status = "done";

        if (pages.length + 1 < state.maxPages) {
          for (const link of r.links) {
            if (state.queue.length >= MAX_QUEUE) break;
            let ln: string;
            try {
              ln = normalizeHttpUrl(link);
            } catch {
              continue;
            }
            if (new URL(ln).hostname.toLowerCase() !== state.originHost) continue;
            if (state.visited.includes(ln)) continue;
            if (state.queue.includes(ln)) continue;
            state.queue.push(ln);
          }
        }
      } catch (e) {
        row.status = "error";
        row.error = e instanceof Error ? e.message : String(e);
      }

      const updated = nextPages.map((p) => (p.id === row.id ? row : p));
      const doneCount2 = updated.filter(
        (p) => p.status === "done" || p.status === "error",
      ).length;
      const completed =
        doneCount2 >= state.maxPages || (state.queue.length === 0 && doneCount2 > 0);

      await prisma.webImportJob.update({
        where: { id: jobId },
        data: {
          pages: updated as unknown as object[],
          state: state as object,
          status: completed ? "completed" : "running",
        },
      });
      return;
    }

    await prisma.webImportJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: `Неизвестный режим: ${mode}`,
      },
    });
  } catch (e) {
    await prisma.webImportJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    });
  }
}
