import { prisma } from "@/lib/prisma";

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function countDonePages(pages: unknown): number {
  if (!Array.isArray(pages)) return 0;
  let n = 0;
  for (const p of pages) {
    if (p && typeof p === "object" && (p as { status?: string }).status === "done") {
      n++;
    }
  }
  return n;
}

/** Успешно спарсенные страницы (status === "done") по всем задачам пользователя с createdAt в текущем календарном месяце (UTC). */
export async function getWebImportPagesUsedThisMonth(userId: string): Promise<number> {
  const since = startOfCurrentMonthUtc();
  const jobs = await prisma.webImportJob.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    select: { pages: true },
  });
  let total = 0;
  for (const j of jobs) {
    total += countDonePages(j.pages);
  }
  return total;
}
