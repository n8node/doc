import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/plan-service";
import {
  getGenerationKopecksPerCredit,
  getGenerationMarginPercent,
  applyGenerationMargin,
} from "@/lib/generation/config";

/** Текущий месяц UTC (начало и конец). */
export function currentMonthUtc(now: Date = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Кредиты для отображения: всегда с наценкой (billedCredits или costCredits + margin). */
function toDisplayCredits(
  costCredits: number | null,
  billedCredits: number | null,
  marginPercent: number
): number {
  if (billedCredits != null && billedCredits > 0) return billedCredits;
  if (costCredits != null && costCredits > 0) return applyGenerationMargin(costCredits, marginPercent);
  return 0;
}

/**
 * Сумма списанных кредитов генерации за текущий месяц (всегда с наценкой для отображения).
 * Исключает задачу с id = excludeTaskId если передан.
 */
/** Сумма кредитов генерации (изображения + видео) за месяц с наценкой. */
export async function getGenerationCreditsUsedThisMonth(
  userId: string,
  exclude?: { imageTaskId?: string; videoTaskId?: string }
): Promise<number> {
  const { start, end } = currentMonthUtc();
  const marginPercent = await getGenerationMarginPercent();
  const [imageTasks, videoTasks] = await Promise.all([
    prisma.imageGenerationTask.findMany({
      where: {
        userId,
        status: "success",
        createdAt: { gte: start, lte: end },
        ...(exclude?.imageTaskId ? { id: { not: exclude.imageTaskId } } : {}),
      },
      select: { costCredits: true, billedCredits: true },
    }),
    prisma.videoGenerationTask.findMany({
      where: {
        userId,
        status: "success",
        createdAt: { gte: start, lte: end },
        ...(exclude?.videoTaskId ? { id: { not: exclude.videoTaskId } } : {}),
      },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  const sumImg = imageTasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
  const sumVid = videoTasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
  return sumImg + sumVid;
}

/** @deprecated используйте getGenerationCreditsUsedThisMonth */
export async function getImageGenerationCreditsUsedThisMonth(
  userId: string,
  excludeTaskId?: string
): Promise<number> {
  return getGenerationCreditsUsedThisMonth(userId, { imageTaskId: excludeTaskId });
}

/** Использовано кредитов (с наценкой) и число успешных генераций за текущий месяц. */
export async function getImageGenerationStatsThisMonth(userId: string): Promise<{ usedCredits: number; count: number }> {
  const { start, end } = currentMonthUtc();
  const [marginPercent, imageTasks, videoTasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.imageGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: start, lte: end } },
      select: { costCredits: true, billedCredits: true },
    }),
    prisma.videoGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: start, lte: end } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  const tasks = [...imageTasks, ...videoTasks];
  const usedCredits = tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
  return { usedCredits, count: tasks.length };
}

/** Сумма кредитов генерации (с наценкой) с даты since. */
export async function getImageGenerationSinceAnchor(userId: string, since: Date): Promise<number> {
  const [marginPercent, imageTasks, videoTasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.imageGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: since } },
      select: { costCredits: true, billedCredits: true },
    }),
    prisma.videoGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: since } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  const tasks = [...imageTasks, ...videoTasks];
  return tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
}

/** Последние успешные генерации для списка списаний (tokensTotal — с наценкой). */
export async function getRecentImageGenerationEvents(
  userId: string,
  limit: number
): Promise<Array<{ id: string; tokensTotal: number; createdAt: Date }>> {
  const marginPercent = await getGenerationMarginPercent();
  const [imageTasks, videoTasks] = await Promise.all([
    prisma.imageGenerationTask.findMany({
      where: { userId, status: "success" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, costCredits: true, billedCredits: true, createdAt: true },
    }),
    prisma.videoGenerationTask.findMany({
      where: { userId, status: "success" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, costCredits: true, billedCredits: true, createdAt: true },
    }),
  ]);
  const merged = [...imageTasks, ...videoTasks]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
  return merged.map((t) => ({
    id: t.id,
    tokensTotal: toDisplayCredits(t.costCredits, t.billedCredits, marginPercent),
    createdAt: t.createdAt,
  }));
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
  billedCredits: number,
  media: "image" | "video" = "image"
): Promise<ApplyGenerationBillingResult> {
  if (billedCredits <= 0) {
    return { ok: true, fromQuota: 0, fromWalletCredits: 0, costCents: 0 };
  }

  const exclude =
    media === "video" ? { videoTaskId: taskId } : { imageTaskId: taskId };
  const [plan, usedBefore] = await Promise.all([
    getUserPlan(userId),
    getGenerationCreditsUsedThisMonth(userId, exclude),
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

  const modelId =
    media === "video"
      ? (
          await prisma.videoGenerationTask.findUnique({
            where: { id: taskId },
            select: { modelId: true },
          })
        )?.modelId
      : (
          await prisma.imageGenerationTask.findUnique({
            where: { id: taskId },
            select: { modelId: true },
          })
        )?.modelId;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { llmWalletBalanceCents: { decrement: costCents } },
    }),
    prisma.marketplaceUsageEvent.create({
      data: {
        userId,
        category: media === "video" ? "video" : "image",
        model: modelId ?? (media === "video" ? "video_generation" : "image_generation"),
        tokensIn: 0,
        tokensOut: 0,
        costCents,
        metadata: { taskId, billedCredits: fromWalletCredits, source: "generation_wallet", media },
      },
    }),
  ]);

  return { ok: true, fromQuota, fromWalletCredits, costCents };
}
