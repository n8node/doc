/**
 * Цены на видео Kling: фиксированные ставки «кредитов за секунду» по строкам (как в админке Kie).
 * Итог: max(1, round(секунды × ставка)). Наценка админа заложена в саму ставку.
 */

export interface VideoPerSecondPricingConfig {
  klingVideo: {
    stdCreditsPerSecNoSound: number;
    stdCreditsPerSecSound: number;
    proCreditsPerSecNoSound: number;
    proCreditsPerSecSound: number;
  };
  klingMotion: {
    creditsPerSec720p: number;
    creditsPerSec1080p: number;
  };
}

/** @deprecated используйте VideoPerSecondPricingConfig */
export type VideoPricingFormulaConfig = VideoPerSecondPricingConfig;

export const DEFAULT_VIDEO_PER_SECOND_PRICING: VideoPerSecondPricingConfig = {
  klingVideo: {
    stdCreditsPerSecNoSound: 12,
    stdCreditsPerSecSound: 14,
    proCreditsPerSecNoSound: 20,
    proCreditsPerSecSound: 22,
  },
  klingMotion: {
    creditsPerSec720p: 18,
    creditsPerSec1080p: 32,
  },
};

/** Совместимость со старыми сохранёнными JSON */
export const DEFAULT_VIDEO_PRICING_FORMULA = DEFAULT_VIDEO_PER_SECOND_PRICING;

const MAX_RATE = 1_000_000;

function clampRate(n: unknown, fallback: number): number {
  const x = typeof n === "number" && !Number.isNaN(n) ? Math.round(n) : parseInt(String(n ?? ""), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.max(0, Math.min(MAX_RATE, x));
}

function isLegacyFormula(raw: Record<string, unknown>): boolean {
  const v = raw.kling30Video;
  return v != null && typeof v === "object" && "stdBase" in (v as object);
}

export function normalizeVideoPricingFormula(raw: unknown): VideoPerSecondPricingConfig {
  const d = DEFAULT_VIDEO_PER_SECOND_PRICING;
  if (!raw || typeof raw !== "object") return structuredClone(d);
  const o = raw as Record<string, unknown>;
  if (isLegacyFormula(o)) return structuredClone(d);

  const kv = o.klingVideo;
  const km = o.klingMotion;

  const klingVideo =
    kv && typeof kv === "object"
      ? {
          stdCreditsPerSecNoSound: clampRate(
            (kv as Record<string, unknown>).stdCreditsPerSecNoSound,
            d.klingVideo.stdCreditsPerSecNoSound,
          ),
          stdCreditsPerSecSound: clampRate(
            (kv as Record<string, unknown>).stdCreditsPerSecSound,
            d.klingVideo.stdCreditsPerSecSound,
          ),
          proCreditsPerSecNoSound: clampRate(
            (kv as Record<string, unknown>).proCreditsPerSecNoSound,
            d.klingVideo.proCreditsPerSecNoSound,
          ),
          proCreditsPerSecSound: clampRate(
            (kv as Record<string, unknown>).proCreditsPerSecSound,
            d.klingVideo.proCreditsPerSecSound,
          ),
        }
      : { ...d.klingVideo };

  const klingMotion =
    km && typeof km === "object"
      ? {
          creditsPerSec720p: clampRate(
            (km as Record<string, unknown>).creditsPerSec720p,
            d.klingMotion.creditsPerSec720p,
          ),
          creditsPerSec1080p: clampRate(
            (km as Record<string, unknown>).creditsPerSec1080p,
            d.klingMotion.creditsPerSec1080p,
          ),
        }
      : { ...d.klingMotion };

  return { klingVideo, klingMotion };
}

/**
 * Кредиты к списанию. Для motion нужен billableDurationSec (длительность референс-видео); иначе 5 с.
 */
export function computeVideoPriceCredits(
  modelId: string,
  variant: string | null,
  cfg: VideoPerSecondPricingConfig,
  billableDurationSec?: number | null,
): number | null {
  if (variant == null || variant === "") return null;
  const parts = variant.split("|");

  if (modelId === "kie-kling-30-video") {
    if (parts.length !== 3) return null;
    const [mode, dPart, sndPart] = parts;
    if (mode !== "std" && mode !== "pro") return null;
    const dm = /^d(\d+)$/.exec(dPart);
    if (!dm) return null;
    const d = Math.min(15, Math.max(3, parseInt(dm[1], 10)));
    const hasSound = sndPart === "snd1" ? true : sndPart === "snd0" ? false : null;
    if (hasSound === null) return null;
    const kv = cfg.klingVideo;
    let rate: number;
    if (mode === "std") {
      rate = hasSound ? kv.stdCreditsPerSecSound : kv.stdCreditsPerSecNoSound;
    } else {
      rate = hasSound ? kv.proCreditsPerSecSound : kv.proCreditsPerSecNoSound;
    }
    return Math.max(1, Math.round(d * rate));
  }

  if (modelId === "kie-kling-30-motion") {
    if (parts.length !== 2) return null;
    const [res, orient] = parts;
    if (orient !== "image" && orient !== "video") return null;
    const dur = billableDurationSec != null && billableDurationSec > 0
      ? Math.min(600, Math.max(1, Math.ceil(billableDurationSec)))
      : 5;
    const km = cfg.klingMotion;
    const rate = res === "720p" ? km.creditsPerSec720p : res === "1080p" ? km.creditsPerSec1080p : null;
    if (rate == null) return null;
    return Math.max(1, Math.round(dur * rate));
  }

  return null;
}

export interface VideoPricingFormulaRow {
  modelId: string;
  variant: string | null;
  priceCredits: number;
  priceUsd: number | null;
}

export function buildVideoPricingRowsFromFormula(cfg: VideoPerSecondPricingConfig): VideoPricingFormulaRow[] {
  const rows: VideoPricingFormulaRow[] = [];
  const durs = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (const mode of ["std", "pro"] as const) {
    for (const d of durs) {
      for (const snd of [0, 1] as const) {
        const variant = `${mode}|d${d}|snd${snd}`;
        const credits = computeVideoPriceCredits("kie-kling-30-video", variant, cfg, d);
        if (credits != null) {
          rows.push({ modelId: "kie-kling-30-video", variant, priceCredits: credits, priceUsd: null });
        }
      }
    }
  }
  const motionDur = 5;
  for (const mode of ["720p", "1080p"] as const) {
    for (const orient of ["image", "video"] as const) {
      const variant = `${mode}|${orient}`;
      const credits = computeVideoPriceCredits("kie-kling-30-motion", variant, cfg, motionDur);
      if (credits != null) {
        rows.push({ modelId: "kie-kling-30-motion", variant, priceCredits: credits, priceUsd: null });
      }
    }
  }
  return rows;
}
