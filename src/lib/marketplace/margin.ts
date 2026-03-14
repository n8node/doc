import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.margin_percent";

const DEFAULT_MARGIN = 0;
const MIN_MARGIN = 0;
const MAX_MARGIN = 95;

/**
 * Получить процент маржи платформы (0–95). По умолчанию 0.
 */
export async function getMarketplaceMarginPercent(): Promise<number> {
  const v = await configStore.get(CONFIG_KEY);
  if (v == null || v === "") return DEFAULT_MARGIN;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < MIN_MARGIN) return DEFAULT_MARGIN;
  if (n > MAX_MARGIN) return MAX_MARGIN;
  return n;
}

/**
 * Применить маржу к базовой стоимости.
 * marginPercent 50 → пользователь платит 2× (платформа получает 50%).
 */
export function applyMargin(baseCostCents: number, marginPercent: number): number {
  if (marginPercent <= 0) return baseCostCents;
  const divisor = 100 - marginPercent;
  if (divisor <= 0) return baseCostCents;
  return Math.max(1, Math.ceil((baseCostCents * 100) / divisor));
}

export const MARGIN_CONFIG_KEY = CONFIG_KEY;
export { MIN_MARGIN, MAX_MARGIN };
