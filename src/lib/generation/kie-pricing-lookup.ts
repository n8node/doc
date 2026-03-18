import { prisma } from "@/lib/prisma";

/** Модели с ценами по разрешению (1K/2K/4K). Для старых задач с variant=null используем 1K. */
const RESOLUTION_VARIANT_MODELS = new Set([
  "kie-nano-banana-pro", "kie-nano-banana-2",
  "kie-flux2-pro-text", "kie-flux2-pro-image", "kie-flux2-flex-text", "kie-flux2-flex-image",
]);

/**
 * Возвращает цену в кредитах для модели (и варианта) из таблицы kie_pricing.
 * Сначала ищет по (modelId, variant), затем по (modelId, null).
 * Для моделей с разрешением при variant=null пробует вариант "1K".
 */
export async function getPriceCreditsForModel(
  modelId: string,
  variant: string | null
): Promise<number | null> {
  const v = variant ?? null;
  const row = await prisma.kiePricing.findFirst({
    where: { modelId, variant: v },
    orderBy: { fetchedAt: "desc" },
  });
  if (row) return row.priceCredits;
  if (v === null && RESOLUTION_VARIANT_MODELS.has(modelId)) {
    const resRow = await prisma.kiePricing.findFirst({
      where: { modelId, variant: "1K" },
      orderBy: { fetchedAt: "desc" },
    });
    if (resRow) return resRow.priceCredits;
  }
  const fallback = await prisma.kiePricing.findFirst({
    where: { modelId, variant: null },
    orderBy: { fetchedAt: "desc" },
  });
  return fallback?.priceCredits ?? null;
}
