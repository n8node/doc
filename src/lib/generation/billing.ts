import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/plan-service";
import { getGenerationKopecksPerCredit } from "@/lib/generation/config";

/** Текущий месяц UTC (начало и конец). */
function currentMonthUtc(now: Date = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Сумма списанных кредитов генерации за текущий месяц (billedCredits ?? costCredits).
 * Исключает задачу с id = excludeTaskId если передан.
 */
export async function getImageGenerationCreditsUsedThisMonth(
  userId: string,
  excludeTaskId?: string
): Promise<number> {
  const { start, end } = currentMonthUtc();
  const tasks = await prisma.imageGenerationTask.findMany({
    where: {
      userId,
      status: "success",
      createdAt: { gte: start, lte: end },
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
    },
    select: { costCredits: true, billedCredits: true },
  });
  return tasks.reduce((sum, t) => {
    const credits = t.billedCredits ?? t.costCredits ?? 0;
    return sum + credits;
  }, 0);
}

export interface ApplyGenerationBillingResult {
  ok: boolean;
  error?: string;
  fromQuota: number;
  fromWalletCredits: number;
  costCents: number;
}

/**
 * Учитывает генерацию: квота по тарифу, остаток — списание с кошелька по курсу.
 * Вызывать после сохранения задачи с costCredits и billedCredits.
 */
export async function applyGenerationBilling(
  userId: string,
  taskId: string,
  billedCredits: number
): Promise<ApplyGenerationBillingResult> {
  if (billedCredits <= 0) {
    return { ok: true, fromQuota: 0, fromWalletCredits: 0, costCents: 0 };
  }

  const [plan, usedBefore] = await Promise.all([
    getUserPlan(userId),
    getImageGenerationCreditsUsedThisMonth(userId, taskId),
  ]);
  const quota = plan?.imageGenerationCreditsQuota ?? 0;
  const remainingQuota = Math.max(0, quota - usedBefore);
  const fromQuota = Math.min(billedCredits, remainingQuota);
  const fromWalletCredits = Math.max(0, billedCredits - fromQuota);

  if (fromWalletCredits === 0) {
    return { ok: true, fromQuota, fromWalletCredits: 0, costCents: 0 };
  }

  const kopecksPerCredit = await getGenerationKopecksPerCredit();
  const costCents = Math.ceil(fromWalletCredits * kopecksPerCredit);
  if (costCents <= 0) {
    return { ok: true, fromQuota, fromWalletCredits, costCents: 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { llmWalletBalanceCents: true },
  });
  const balance = user?.llmWalletBalanceCents ?? 0;
  if (balance < costCents) {
    return {
      ok: false,
      error: "Недостаточно средств на кошельке для списания за генерацию",
      fromQuota,
      fromWalletCredits,
      costCents,
    };
  }

  const task = await prisma.imageGenerationTask.findUnique({
    where: { id: taskId },
    select: { modelId: true },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { llmWalletBalanceCents: { decrement: costCents } },
    }),
    prisma.marketplaceUsageEvent.create({
      data: {
        userId,
        category: "image",
        model: task?.modelId ?? "image_generation",
        tokensIn: 0,
        tokensOut: 0,
        costCents,
        metadata: { taskId, billedCredits: fromWalletCredits, source: "generation_wallet" },
      },
    }),
  ]);

  return { ok: true, fromQuota, fromWalletCredits, costCents };
}
