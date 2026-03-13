import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "./settings";

/**
 * Средневзвешенный курс RUB/USD по партиям с остатком
 */
export async function getBlendedRateRubPerUsd(): Promise<number | null> {
  const batches = await prisma.openRouterTopupBatch.findMany({
    where: { usdRemaining: { gt: 0 } },
  });
  if (batches.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;
  for (const b of batches) {
    const w = b.usdRemaining;
    totalWeight += w;
    weightedSum += w * b.effectiveRateRubPerUsd;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Рабочий курс = blended * (1 + fx_buffer)
 */
export async function getWorkingRateRubPerUsd(): Promise<number | null> {
  const [blended, settings] = await Promise.all([
    getBlendedRateRubPerUsd(),
    getFinanceSettings(),
  ]);
  if (blended == null) return null;
  const buffer = 1 + (settings.fxBufferPct ?? 0) / 100;
  return blended * buffer;
}
