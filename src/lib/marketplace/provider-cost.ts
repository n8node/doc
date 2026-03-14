import { getBlendedRateRubPerUsd } from "@/lib/finance/blended-rate";
import { calculateCostCents } from "./pricing";

/**
 * Извлечь стоимость запроса в USD из ответа OpenRouter.
 * OpenRouter возвращает cost в usage или на верхнем уровне (в долларах).
 */
export function parseProviderCostUsd(data: Record<string, unknown>): number | null {
  const usage = data.usage as Record<string, unknown> | undefined;
  const fromUsage = usage && typeof usage.cost === "number" && usage.cost >= 0 ? usage.cost : null;
  const fromRoot = typeof data.cost === "number" && data.cost >= 0 ? data.cost : null;
  const usd = fromUsage ?? fromRoot;
  return usd != null && Number.isFinite(usd) ? usd : null;
}

/**
 * Базовая стоимость в копейках для списания: по факту OpenRouter (USD → RUB) или по токенам.
 * Если в ответе есть cost (USD) и есть курс — переводим в рубли и округляем до копеек.
 * Иначе используем расчёт по токенам (pricing.ts).
 */
export async function getBaseCostCents(
  data: Record<string, unknown>,
  tokensIn: number,
  tokensOut: number
): Promise<{ baseCostCents: number; costUsd: number | null }> {
  const costUsd = parseProviderCostUsd(data);
  if (costUsd != null && costUsd > 0) {
    const rate = await getBlendedRateRubPerUsd();
    if (rate != null && rate > 0) {
      const rub = costUsd * rate;
      const baseCostCents = Math.max(1, Math.ceil(rub * 100));
      return { baseCostCents, costUsd };
    }
  }
  const baseCostCents = calculateCostCents(tokensIn, tokensOut);
  return { baseCostCents, costUsd: null };
}
