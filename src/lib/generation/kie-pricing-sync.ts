import { prisma } from "@/lib/prisma";

const KIE_PRICING_URL = "https://kie.ai/pricing";

export interface KiePriceRow {
  modelId: string;
  variant: string | null;
  priceCredits: number;
  priceUsd: number | null;
}

/** Канонические строки прайса для видео (Kling): mode × длительность × звук; motion × разрешение × ориентация. */
export function buildDefaultVideoPricingRows(): KiePriceRow[] {
  const rows: KiePriceRow[] = [];
  const durs = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (const mode of ["std", "pro"] as const) {
    for (const d of durs) {
      for (const snd of [0, 1] as const) {
        const base = mode === "std" ? 35 : 70;
        const credits = base + d * (mode === "std" ? 5 : 10) + snd * 8;
        rows.push({
          modelId: "kie-kling-30-video",
          variant: `${mode}|d${d}|snd${snd}`,
          priceCredits: credits,
          priceUsd: null,
        });
      }
    }
  }
  for (const mode of ["720p", "1080p"] as const) {
    for (const orient of ["image", "video"] as const) {
      rows.push({
        modelId: "kie-kling-30-motion",
        variant: `${mode}|${orient}`,
        priceCredits: mode === "720p" ? 90 : 160,
        priceUsd: null,
      });
    }
  }
  return rows;
}

/** Цены по умолчанию, если страница не парсится (обновить по https://kie.ai/pricing). Для моделей с разрешением — отдельные строки по 1K/2K/4K. */
const DEFAULT_PRICES: KiePriceRow[] = [
  { modelId: "kie-4o-image", variant: null, priceCredits: 10, priceUsd: null },
  { modelId: "kie-flux-kontext", variant: null, priceCredits: 15, priceUsd: null },
  { modelId: "kie-flux-kontext", variant: "flux-kontext-pro", priceCredits: 15, priceUsd: null },
  { modelId: "kie-flux-kontext", variant: "flux-kontext-max", priceCredits: 25, priceUsd: null },
  { modelId: "kie-nano-banana-pro", variant: "1K", priceCredits: 10, priceUsd: null },
  { modelId: "kie-nano-banana-pro", variant: "2K", priceCredits: 20, priceUsd: null },
  { modelId: "kie-nano-banana-pro", variant: "4K", priceCredits: 40, priceUsd: null },
  { modelId: "kie-nano-banana-2", variant: "1K", priceCredits: 10, priceUsd: null },
  { modelId: "kie-nano-banana-2", variant: "2K", priceCredits: 20, priceUsd: null },
  { modelId: "kie-nano-banana-2", variant: "4K", priceCredits: 40, priceUsd: null },
  { modelId: "kie-nano-banana", variant: null, priceCredits: 8, priceUsd: null },
  { modelId: "kie-nano-banana-edit", variant: null, priceCredits: 10, priceUsd: null },
  { modelId: "kie-qwen-text-to-image", variant: null, priceCredits: 8, priceUsd: null },
  { modelId: "kie-qwen-image-to-image", variant: null, priceCredits: 10, priceUsd: null },
  { modelId: "kie-gpt-image-15-text", variant: null, priceCredits: 12, priceUsd: null },
  { modelId: "kie-gpt-image-15-image", variant: null, priceCredits: 12, priceUsd: null },
  { modelId: "kie-flux2-pro-text", variant: "1K", priceCredits: 15, priceUsd: null },
  { modelId: "kie-flux2-pro-text", variant: "2K", priceCredits: 25, priceUsd: null },
  { modelId: "kie-flux2-pro-image", variant: "1K", priceCredits: 15, priceUsd: null },
  { modelId: "kie-flux2-pro-image", variant: "2K", priceCredits: 25, priceUsd: null },
  { modelId: "kie-flux2-flex-text", variant: "1K", priceCredits: 10, priceUsd: null },
  { modelId: "kie-flux2-flex-text", variant: "2K", priceCredits: 18, priceUsd: null },
  { modelId: "kie-flux2-flex-image", variant: "1K", priceCredits: 10, priceUsd: null },
  { modelId: "kie-flux2-flex-image", variant: "2K", priceCredits: 18, priceUsd: null },
  { modelId: "kie-qwen-image-edit", variant: null, priceCredits: 10, priceUsd: null },
  { modelId: "kie-qwen2-text-to-image", variant: null, priceCredits: 8, priceUsd: null },
  { modelId: "kie-qwen2-image-edit", variant: null, priceCredits: 8, priceUsd: null },
  ...buildDefaultVideoPricingRows(),
];

/**
 * Парсит HTML страницы kie.ai/pricing: ищет __NEXT_DATA__ или данные в script.
 * Возвращает массив цен или null при неудаче.
 */
function parsePricingFromHtml(html: string): KiePriceRow[] | null {
  try {
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch?.[1]) {
      const data = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const props = data.props as Record<string, unknown> | undefined;
      const pageProps = props?.pageProps as Record<string, unknown> | undefined;
      if (pageProps?.pricing != null || pageProps?.prices != null) {
        const raw = (pageProps.pricing ?? pageProps.prices) as unknown;
        return normalizePricingFromApi(raw);
      }
      const buildId = data.buildId;
      if (buildId && typeof pageProps === "object") {
        const list = extractPricesFromProps(pageProps);
        if (list.length > 0) return list;
      }
    }
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        const inner = block.replace(/<\/?script[^>]*>/gi, "").trim();
        const parsed = JSON.parse(inner) as Record<string, unknown>;
        const list = normalizePricingFromApi(parsed);
        if (list.length > 0) return list;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function extractPricesFromProps(pageProps: Record<string, unknown>): KiePriceRow[] {
  const out: KiePriceRow[] = [];
  const tables = pageProps.tables ?? pageProps.pricingTable;
  if (Array.isArray(tables)) {
    for (const t of tables) {
      const rows = (t as Record<string, unknown>).rows ?? (t as Record<string, unknown>).items;
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          const model = String(row.model ?? row.name ?? row.modelId ?? "").trim();
          const credits = numberFrom(row.credits ?? row.priceCredits ?? row.price);
          if (model && credits > 0) {
            const modelId = mapKieModelToOurs(model);
            if (modelId) out.push({ modelId, variant: null, priceCredits: credits, priceUsd: null });
          }
        }
      }
    }
  }
  return out;
}

function numberFrom(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function mapKieModelToOurs(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("4o") && (lower.includes("image") || lower.includes("gpt"))) return "kie-4o-image";
  if (lower.includes("flux") && lower.includes("kontext")) return "kie-flux-kontext";
  return null;
}

function normalizePricingFromApi(raw: unknown): KiePriceRow[] {
  const out: KiePriceRow[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const o = item as Record<string, unknown>;
      const modelId = String(o.modelId ?? o.model_id ?? o.id ?? "").trim();
      const variant = o.variant != null ? String(o.variant) : null;
      const credits = numberFrom(o.priceCredits ?? o.credits ?? o.price_credits ?? o.price);
      const usd = typeof o.priceUsd === "number" ? o.priceUsd : typeof o.price_usd === "number" ? o.price_usd : null;
      if (modelId && credits > 0) {
        const ours = mapKieModelToOurs(modelId) ?? modelId;
        out.push({ modelId: ours, variant, priceCredits: credits, priceUsd: usd });
      }
    }
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, { credits?: number; price?: number; priceUsd?: number }>;
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === "object" && (typeof val.credits === "number" || typeof val.price === "number")) {
        const credits = val.credits ?? val.price ?? 0;
        if (credits > 0) {
          const modelId = mapKieModelToOurs(key) ?? key;
          out.push({ modelId, variant: null, priceCredits: credits, priceUsd: val.priceUsd ?? null });
        }
      }
    }
  }
  return out;
}

/**
 * Синхронизирует прайс: запрашивает kie.ai/pricing, парсит, обновляет kie_pricing.
 * Если парсинг не удался — записывает цены по умолчанию.
 */
export async function syncKiePricing(): Promise<{ ok: boolean; parsed: number; usedDefaults: boolean; error?: string }> {
  let html: string;
  try {
    const res = await fetch(KIE_PRICING_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KiePricingSync/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    await upsertPrices(DEFAULT_PRICES);
    return {
      ok: true,
      parsed: 0,
      usedDefaults: true,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }

  const parsed = parsePricingFromHtml(html);
  const rows = parsed && parsed.length > 0 ? parsed : DEFAULT_PRICES;
  const usedDefaults = !parsed || parsed.length === 0;
  await upsertPrices(rows);
  return {
    ok: true,
    parsed: parsed?.length ?? 0,
    usedDefaults,
  };
}

async function upsertPrices(rows: KiePriceRow[]): Promise<void> {
  const now = new Date();
  for (const row of rows) {
    const variant = row.variant ?? null;
    const existing = await prisma.kiePricing.findFirst({
      where: { modelId: row.modelId, variant },
    });
    if (existing) {
      await prisma.kiePricing.update({
        where: { id: existing.id },
        data: { priceCredits: row.priceCredits, priceUsd: row.priceUsd, fetchedAt: now },
      });
    } else {
      await prisma.kiePricing.create({
        data: {
          modelId: row.modelId,
          variant,
          priceCredits: row.priceCredits,
          priceUsd: row.priceUsd,
          fetchedAt: now,
        },
      });
    }
  }
}

/**
 * Дополняет таблицу kie_pricing строками для всех канонических моделей и вариантов (DEFAULT_PRICES).
 * Если записи для пары (modelId, variant) ещё нет — создаётся с дефолтной ценой.
 * Вызывать при загрузке раздела «Прайс» в админке, чтобы можно было проставить цены для недостающих.
 */
export async function ensureCanonicalPricingRows(): Promise<{ added: number }> {
  let added = 0;
  const now = new Date();
  for (const row of DEFAULT_PRICES) {
    const variant = row.variant ?? null;
    const existing = await prisma.kiePricing.findFirst({
      where: { modelId: row.modelId, variant },
    });
    if (!existing) {
      await prisma.kiePricing.create({
        data: {
          modelId: row.modelId,
          variant,
          priceCredits: row.priceCredits,
          priceUsd: row.priceUsd,
          fetchedAt: now,
        },
      });
      added++;
    }
  }
  return { added };
}
