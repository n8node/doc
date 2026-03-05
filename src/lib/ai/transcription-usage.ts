import { prisma } from "@/lib/prisma";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Sum transcription minutes used by the user in the current calendar month.
 */
export async function getTranscriptionMinutesUsedThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfCurrentMonth();

  const tasks = await prisma.aiTask.findMany({
    where: {
      userId,
      type: "TRANSCRIPTION",
      status: "completed",
      completedAt: { gte: since },
    },
    select: { output: true },
  });

  let total = 0;
  for (const task of tasks) {
    const output = task.output as { minutesUsed?: number } | null;
    total += output?.minutesUsed ?? 0;
  }
  return total;
}
