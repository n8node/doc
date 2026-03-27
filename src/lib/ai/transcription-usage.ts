import { prisma } from "@/lib/prisma";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

type TranscriptionOutput = {
  minutesUsed?: number;
  sourceKind?: "audio" | "video";
};

/**
 * Sum transcription minutes used by the user in the current calendar month (все задачи).
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
    const output = task.output as TranscriptionOutput | null;
    total += output?.minutesUsed ?? 0;
  }
  return total;
}

/** Минуты по задачам, не помеченным как видео (включая legacy без sourceKind). */
export async function getTranscriptionAudioMinutesUsedThisMonth(
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
    const output = task.output as TranscriptionOutput | null;
    if (output?.sourceKind === "video") continue;
    total += output?.minutesUsed ?? 0;
  }
  return total;
}

/** Минуты только для видео (sourceKind === video). */
export async function getTranscriptionVideoMinutesUsedThisMonth(
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
    const output = task.output as TranscriptionOutput | null;
    if (output?.sourceKind !== "video") continue;
    total += output?.minutesUsed ?? 0;
  }
  return total;
}
