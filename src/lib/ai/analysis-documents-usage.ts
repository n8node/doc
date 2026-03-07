import { prisma } from "@/lib/prisma";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Count completed ANALYSIS tasks (AI document analysis) by the user in the current calendar month.
 */
export async function getAnalysisDocumentsUsedThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfCurrentMonth();

  const count = await prisma.aiTask.count({
    where: {
      userId,
      type: "ANALYSIS",
      status: "completed",
      completedAt: { gte: since },
    },
  });

  return count;
}
