import { prisma } from "@/lib/prisma";

/**
 * Start of current calendar month (UTC).
 */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Sum embedding tokens used by the user in the current calendar month.
 */
export async function getEmbeddingTokensUsedThisMonth(userId: string): Promise<number> {
  const since = startOfCurrentMonth();

  const tasks = await prisma.aiTask.findMany({
    where: {
      userId,
      type: "EMBEDDING",
      status: "completed",
      completedAt: { gte: since },
    },
    select: { output: true },
  });

  let total = 0;
  for (const task of tasks) {
    const output = task.output as { tokensUsed?: number; promptTokens?: number } | null;
    total += output?.tokensUsed ?? output?.promptTokens ?? 0;
  }
  return total;
}
