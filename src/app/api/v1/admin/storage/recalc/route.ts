import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/admin/storage/recalc
 * Пересчитывает user.storageUsed из фактических размеров файлов (File.size).
 * Синхронизирует denormalized поле для квот и отображения.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const perUser = await prisma.file.groupBy({
    by: ["userId"],
    _sum: { size: true },
    _count: true,
  });

  let updated = 0;
  for (const row of perUser) {
    const total = Number(row._sum.size ?? 0);
    await prisma.user.update({
      where: { id: row.userId },
      data: { storageUsed: BigInt(total) },
    });
    updated++;
  }

  // Сбросить storageUsed для пользователей без файлов (если у них было > 0)
  const userIdsWithFiles = new Set(perUser.map((r) => r.userId));
  const usersToReset = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(userIdsWithFiles) },
      storageUsed: { gt: 0 },
    },
    select: { id: true },
  });

  for (const u of usersToReset) {
    await prisma.user.update({
      where: { id: u.id },
      data: { storageUsed: BigInt(0) },
    });
    updated++;
  }

  return NextResponse.json({
    ok: true,
    usersWithFiles: perUser.length,
    usersReset: usersToReset.length,
    totalUpdated: updated,
  });
}
