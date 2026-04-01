/**
 * Формульный расчёт кредитов для видео Kling (без ручного редактирования сотен строк kie_pricing).
 * Итог: max(1, round(база + длительность×коэф + звук + доп. наценка на модель)).
 */

export interface VideoPricingFormulaConfig {
  kling30Video: {
    stdBase: number;
    proBase: number;
    stdPerSec: number;
    proPerSec: number;
    soundExtra: number;
  };
  kling30Motion: {
    credits720p: number;
    credits1080p: number;
  };
  /** Дополнительные кредиты сверх формулы, по id модели (kie-kling-30-video, kie-kling-30-motion). */
  modelExtraCredits: Record<string, number>;
}

export const DEFAULT_VIDEO_PRICING_FORMULA: VideoPricingFormulaConfig = {
  kling30Video: {
    stdBase: 35,
    proBase: 70,
    stdPerSec: 5,
    proPerSec: 10,
    soundExtra: 8,
  },
  kling30Motion: {
    credits720p: 90,
    credits1080p: 160,
  },
  modelExtraCredits: {
    "kie-kling-30-video": 0,
    "kie-kling-30-motion": 0,
  },
};

const MAX_COMPONENT = 1_000_000;

function clampInt(n: unknown, fallback: number): number {
  const x = typeof n === "number" && !Number.isNaN(n) ? Math.round(n) : parseInt(String(n ?? ""), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.max(0, Math.min(MAX_COMPONENT, x));
}

/** Нормализация JSON из админки / стора. */
export function normalizeVideoPricingFormula(raw: unknown): VideoPricingFormulaConfig {
  const d = DEFAULT_VIDEO_PRICING_FORMULA;
  if (!raw || typeof raw !== "object") return structuredClone(d);
  const o = raw as Record<string, unknown>;
  const v = o.kling30Video;
  const m = o.kling30Motion;
  const extras = o.modelExtraCredits;

  const kling30Video =
    v && typeof v === "object"
      ? {
          stdBase: clampInt((v as Record<string, unknown>).stdBase, d.kling30Video.stdBase),
          proBase: clampInt((v as Record<string, unknown>).proBase, d.kling30Video.proBase),
          stdPerSec: clampInt((v as Record<string, unknown>).stdPerSec, d.kling30Video.stdPerSec),
          proPerSec: clampInt((v as Record<string, unknown>).proPerSec, d.kling30Video.proPerSec),
          soundExtra: clampInt((v as Record<string, unknown>).soundExtra, d.kling30Video.soundExtra),
        }
      : { ...d.kling30Video };

  const kling30Motion =
    m && typeof m === "object"
      ? {
          credits720p: clampInt((m as Record<string, unknown>).credits720p, d.kling30Motion.credits720p),
          credits1080p: clampInt((m as Record<string, unknown>).credits1080p, d.kling30Motion.credits1080p),
        }
      : { ...d.kling30Motion };

  const modelExtraCredits: Record<string, number> = { ...d.modelExtraCredits };
  if (extras && typeof extras === "object") {
    for (const [k, val] of Object.entries(extras as Record<string, unknown>)) {
      if (typeof k === "string" && k.length > 0) {
        modelExtraCredits[k] = clampInt(val, 0);
      }
    }
  }

  return { kling30Video, kling30Motion, modelExtraCredits };
}

/**
 * Кредиты для списания по сохранённому variant задачи.
 * Возвращает null, если variant не распознан (тогда можно падать на kie_pricing).
 */
export function computeVideoPriceCredits(
  modelId: string,
  variant: string | null,
  f: VideoPricingFormulaConfig
): number | null {
  if (variant == null || variant === "") return null;
  const parts = variant.split("|");
  const extra = f.modelExtraCredits[modelId] ?? 0;

  if (modelId === "kie-kling-30-video") {
    if (parts.length !== 3) return null;
    const [mode, dPart, sndPart] = parts;
    if (mode !== "std" && mode !== "pro") return null;
    const dm = /^d(\d+)$/.exec(dPart);
    if (!dm) return null;
    const d = Math.min(15, Math.max(3, parseInt(dm[1], 10)));
    const snd =
      sndPart === "snd1" ? 1 : sndPart === "snd0" ? 0 : null;
    if (snd === null) return null;
    const kv = f.kling30Video;
    const base = mode === "std" ? kv.stdBase : kv.proBase;
    const per = mode === "std" ? kv.stdPerSec : kv.proPerSec;
    return Math.max(1, Math.round(base + d * per + snd * kv.soundExtra + extra));
  }

  if (modelId === "kie-kling-30-motion") {
    if (parts.length !== 2) return null;
    const [res, orient] = parts;
    if (orient !== "image" && orient !== "video") return null;
    const km = f.kling30Motion;
    let base = 0;
    if (res === "720p") base = km.credits720p;
    else if (res === "1080p") base = km.credits1080p;
    else return null;
    return Math.max(1, Math.round(base + extra));
  }

  return null;
}

export interface VideoPricingFormulaRow {
  modelId: string;
  variant: string | null;
  priceCredits: number;
  priceUsd: number | null;
}

/** Строки для синхронизации/дефолтов в kie_pricing (должны совпадать с формулой). */
export function buildVideoPricingRowsFromFormula(f: VideoPricingFormulaConfig): VideoPricingFormulaRow[] {
  const rows: VideoPricingFormulaRow[] = [];
  const durs = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (const mode of ["std", "pro"] as const) {
    for (const d of durs) {
      for (const snd of [0, 1] as const) {
        const variant = `${mode}|d${d}|snd${snd}`;
        const credits = computeVideoPriceCredits("kie-kling-30-video", variant, f);
        if (credits != null) {
          rows.push({ modelId: "kie-kling-30-video", variant, priceCredits: credits, priceUsd: null });
        }
      }
    }
  }
  for (const mode of ["720p", "1080p"] as const) {
    for (const orient of ["image", "video"] as const) {
      const variant = `${mode}|${orient}`;
      const credits = computeVideoPriceCredits("kie-kling-30-motion", variant, f);
      if (credits != null) {
        rows.push({ modelId: "kie-kling-30-motion", variant, priceCredits: credits, priceUsd: null });
      }
    }
  }
  return rows;
}
