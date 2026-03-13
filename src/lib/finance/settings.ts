import { configStore } from "@/lib/config-store";

const KEYS = {
  taxRatePct: "finance.tax_rate_pct",
  paymentCommissionPct: "finance.payment_commission_pct",
  paymentCommissionPayer: "finance.payment_commission_payer",
  fxBufferPct: "finance.fx_buffer_pct",
  s3CostPerGbDayCents: "finance.s3_cost_per_gb_day_cents",
  s3MarkupPct: "finance.s3_markup_pct",
  defaultTokenMarkupPct: "finance.default_token_markup_pct",
} as const;

export type PaymentCommissionPayer = "platform" | "user";

export interface FinanceSettings {
  taxRatePct: number;
  paymentCommissionPct: number;
  paymentCommissionPayer: PaymentCommissionPayer;
  fxBufferPct: number;
  s3CostPerGbDayCents: number;
  s3MarkupPct: number;
  defaultTokenMarkupPct: number;
}

const DEFAULTS: FinanceSettings = {
  taxRatePct: 7,
  paymentCommissionPct: 2.5,
  paymentCommissionPayer: "platform",
  fxBufferPct: 5,
  s3CostPerGbDayCents: 7, // 0.07 ₽
  s3MarkupPct: 30,
  defaultTokenMarkupPct: 30,
};

async function getNum(key: string, def: number): Promise<number> {
  const v = await configStore.get(key);
  if (v == null || v === "") return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

async function getStr(key: string, def: string): Promise<string> {
  const v = await configStore.get(key);
  return v != null && v !== "" ? v : def;
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const [taxRatePct, paymentCommissionPct, paymentCommissionPayer, fxBufferPct, s3CostPerGbDayCents, s3MarkupPct, defaultTokenMarkupPct] =
    await Promise.all([
      getNum(KEYS.taxRatePct, DEFAULTS.taxRatePct),
      getNum(KEYS.paymentCommissionPct, DEFAULTS.paymentCommissionPct),
      getStr(KEYS.paymentCommissionPayer, DEFAULTS.paymentCommissionPayer).then((s) =>
        s === "user" ? "user" : "platform"
      ),
      getNum(KEYS.fxBufferPct, DEFAULTS.fxBufferPct),
      getNum(KEYS.s3CostPerGbDayCents, DEFAULTS.s3CostPerGbDayCents),
      getNum(KEYS.s3MarkupPct, DEFAULTS.s3MarkupPct),
      getNum(KEYS.defaultTokenMarkupPct, DEFAULTS.defaultTokenMarkupPct),
    ]);

  return {
    taxRatePct,
    paymentCommissionPct,
    paymentCommissionPayer: paymentCommissionPayer as PaymentCommissionPayer,
    fxBufferPct,
    s3CostPerGbDayCents,
    s3MarkupPct,
    defaultTokenMarkupPct,
  };
}

export async function setFinanceSettings(settings: Partial<FinanceSettings>): Promise<void> {
  const entries: [string, string][] = [];
  if (settings.taxRatePct != null)
    entries.push([KEYS.taxRatePct, String(settings.taxRatePct)]);
  if (settings.paymentCommissionPct != null)
    entries.push([KEYS.paymentCommissionPct, String(settings.paymentCommissionPct)]);
  if (settings.paymentCommissionPayer != null)
    entries.push([KEYS.paymentCommissionPayer, settings.paymentCommissionPayer]);
  if (settings.fxBufferPct != null)
    entries.push([KEYS.fxBufferPct, String(settings.fxBufferPct)]);
  if (settings.s3CostPerGbDayCents != null)
    entries.push([KEYS.s3CostPerGbDayCents, String(settings.s3CostPerGbDayCents)]);
  if (settings.s3MarkupPct != null)
    entries.push([KEYS.s3MarkupPct, String(settings.s3MarkupPct)]);
  if (settings.defaultTokenMarkupPct != null)
    entries.push([KEYS.defaultTokenMarkupPct, String(settings.defaultTokenMarkupPct)]);

  for (const [key, value] of entries) {
    await configStore.set(key, value, { category: "finance", description: key });
    configStore.invalidate(key);
  }
}
