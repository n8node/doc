import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    blockedUsers,
    newThisWeek,
    newThisMonth,
    activeThisWeek,
    totalFiles,
    storageAgg,
    planDistribution,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBlocked: true } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: weekAgo } } }),
    prisma.file.count(),
    prisma.user.aggregate({
      _sum: { storageUsed: true, storageQuota: true },
    }),
    prisma.user.groupBy({
      by: ["planId"],
      _count: { id: true },
    }),
  ]);

  const planIds = planDistribution
    .map((d) => d.planId)
    .filter((id): id is string => id !== null);

  const plans =
    planIds.length > 0
      ? await prisma.plan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : [];

  const planMap = new Map(plans.map((p) => [p.id, p.name]));

  return NextResponse.json({
    totalUsers,
    blockedUsers,
    newThisWeek,
    newThisMonth,
    activeThisWeek,
    totalFiles,
    totalStorageUsed: Number(storageAgg._sum.storageUsed ?? 0),
    totalStorageQuota: Number(storageAgg._sum.storageQuota ?? 0),
    planDistribution: planDistribution.map((d) => ({
      planId: d.planId,
      planName: d.planId ? planMap.get(d.planId) ?? "Неизвестный" : "Без тарифа",
      count: d._count.id,
    })),
  });
}
