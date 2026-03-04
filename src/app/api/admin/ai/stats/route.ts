import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@/lib/admin-guard";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period") ?? "30"; // days
  const days = Math.min(365, Math.max(1, parseInt(period, 10) || 30));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const tasks = await prisma.aiTask.findMany({
    where: {
      type: "EMBEDDING",
      status: "completed",
      completedAt: { gte: since },
    },
    select: {
      id: true,
      output: true,
      providerId: true,
      completedAt: true,
    },
    orderBy: { completedAt: "desc" },
  });

  let totalTokens = 0;
  const byProvider = new Map<string, { tokens: number; tasks: number }>();

  for (const task of tasks) {
    const output = task.output as { tokensUsed?: number; promptTokens?: number } | null;
    const tokens = output?.tokensUsed ?? output?.promptTokens ?? 0;
    totalTokens += tokens;
    if (task.providerId) {
      const cur = byProvider.get(task.providerId) ?? { tokens: 0, tasks: 0 };
      cur.tokens += tokens;
      cur.tasks += 1;
      byProvider.set(task.providerId, cur);
    }
  }

  const providerIds = Array.from(byProvider.keys());
  const providers =
    providerIds.length > 0
      ? await prisma.aiProvider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true },
        })
      : [];
  const providerMap = new Map(providers.map((p) => [p.id, p.name]));

  const byProviderList = Array.from(byProvider.entries()).map(([id, data]) => ({
    providerId: id,
    providerName: providerMap.get(id) ?? "—",
    tokensUsed: data.tokens,
    tasksCount: data.tasks,
  }));

  return NextResponse.json({
    periodDays: days,
    since: since.toISOString(),
    totalTokensUsed: totalTokens,
    tasksCount: tasks.length,
    byProvider: byProviderList,
  });
}
