import { prisma } from "@/lib/prisma";

/**
 * Возвращает цену в кредитах для модели (и варианта) из таблицы kie_pricing.
 * Сначала ищет по (modelId, variant), затем по (modelId, null).
 */
export async function getPriceCreditsForModel(
  modelId: string,
  variant: string | null
): Promise<number | null> {
  const row = await prisma.kiePricing.findFirst({
    where: {
      modelId,
      variant: variant ?? null,
    },
    orderBy: { fetchedAt: "desc" },
  });
  if (row) return row.priceCredits;
  const fallback = await prisma.kiePricing.findFirst({
    where: { modelId, variant: null },
    orderBy: { fetchedAt: "desc" },
  });
  return fallback?.priceCredits ?? null;
}
