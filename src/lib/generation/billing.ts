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

/** Сумма кредитов за месяц только по изображениям (с наценкой). */
export async function getImageGenerationCreditsUsedThisMonth(
  userId: string,
  excludeTaskId?: string
): Promise<number> {
  const { start, end } = currentMonthUtc();
  const marginPercent = await getGenerationMarginPercent();
  const tasks = await prisma.imageGenerationTask.findMany({
    where: {
      userId,
      status: "success",
      createdAt: { gte: start, lte: end },
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
    },
    select: { costCredits: true, billedCredits: true },
  });
  return tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
}

/** Сумма кредитов за месяц только по видео (с наценкой). */
export async function getVideoGenerationCreditsUsedThisMonth(
  userId: string,
  excludeTaskId?: string
): Promise<number> {
  const { start, end } = currentMonthUtc();
  const marginPercent = await getGenerationMarginPercent();
  const tasks = await prisma.videoGenerationTask.findMany({
    where: {
      userId,
      status: "success",
      createdAt: { gte: start, lte: end },
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
    },
    select: { costCredits: true, billedCredits: true },
  });
  return tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
}

/** Изображения + видео (для сводной статистики). */
export async function getGenerationCreditsUsedThisMonth(
  userId: string,
  exclude?: { imageTaskId?: string; videoTaskId?: string }
): Promise<number> {
  const [img, vid] = await Promise.all([
    getImageGenerationCreditsUsedThisMonth(userId, exclude?.imageTaskId),
    getVideoGenerationCreditsUsedThisMonth(userId, exclude?.videoTaskId),
  ]);
  return img + vid;
}

/** Использовано кредитов и число успешных генераций изображений за месяц. */
export async function getImageGenerationStatsThisMonth(
  userId: string
): Promise<{ usedCredits: number; count: number }> {
  const { start, end } = currentMonthUtc();
  const [marginPercent, tasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.imageGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: start, lte: end } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  const usedCredits = tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
  return { usedCredits, count: tasks.length };
}

/** Использовано кредитов и число успешных генераций видео за месяц. */
export async function getVideoGenerationStatsThisMonth(
  userId: string
): Promise<{ usedCredits: number; count: number }> {
  const { start, end } = currentMonthUtc();
  const [marginPercent, tasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.videoGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: start, lte: end } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  const usedCredits = tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
  return { usedCredits, count: tasks.length };
}

export async function getImageGenerationSinceAnchor(userId: string, since: Date): Promise<number> {
  const [marginPercent, tasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.imageGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: since } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  return tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
}

export async function getVideoGenerationSinceAnchor(userId: string, since: Date): Promise<number> {
  const [marginPercent, tasks] = await Promise.all([
    getGenerationMarginPercent(),
    prisma.videoGenerationTask.findMany({
      where: { userId, status: "success", createdAt: { gte: since } },
      select: { costCredits: true, billedCredits: true },
    }),
  ]);
  return tasks.reduce((sum, t) => sum + toDisplayCredits(t.costCredits, t.billedCredits, marginPercent), 0);
}

export async function getRecentImageGenerationEvents(
  userId: string,
  limit: number
): Promise<Array<{ id: string; tokensTotal: number; createdAt: Date }>> {
  const marginPercent = await getGenerationMarginPercent();
  const tasks = await prisma.imageGenerationTask.findMany({
    where: { userId, status: "success" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, costCredits: true, billedCredits: true, createdAt: true },
  });
  return tasks.map((t) => ({
    id: t.id,
    tokensTotal: toDisplayCredits(t.costCredits, t.billedCredits, marginPercent),
    createdAt: t.createdAt,
  }));
}

export async function getRecentVideoGenerationEvents(
  userId: string,
  limit: number
): Promise<Array<{ id: string; tokensTotal: number; createdAt: Date }>> {
  const marginPercent = await getGenerationMarginPercent();
  const tasks = await prisma.videoGenerationTask.findMany({
    where: { userId, status: "success" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, costCredits: true, billedCredits: true, createdAt: true },
  });
  return tasks.map((t) => ({
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
 * quota null = безлимит по тарифу (не трогаем кошелёк).
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

  const plan = await getUserPlan(userId);
  const quotaRaw =
    media === "video" ? plan?.videoGenerationCreditsQuota : plan?.imageGenerationCreditsQuota;

  const usedBefore =
    media === "video"
      ? await getVideoGenerationCreditsUsedThisMonth(userId, taskId)
      : await getImageGenerationCreditsUsedThisMonth(userId, taskId);

  if (quotaRaw == null) {
    return { ok: true, fromQuota: billedCredits, fromWalletCredits: 0, costCents: 0 };
  }

  const remainingQuota = Math.max(0, quotaRaw - usedBefore);
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
