import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getGenerationMarginPercent, applyGenerationMargin } from "@/lib/generation/config";

/**
 * GET /api/v1/admin/generation/stats?limit=50&offset=0
 * Список генераций для статистики: кто, когда, модель, стоимость (факт и с наценкой).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  const [tasks, marginPercent] = await Promise.all([
    prisma.imageGenerationTask.findMany({
      where: { status: "success" },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    getGenerationMarginPercent(),
  ]);

  const items = tasks.map((t) => ({
    id: t.id,
    userId: t.userId,
    userEmail: t.user.email,
    userName: t.user.name ?? null,
    createdAt: t.createdAt.toISOString(),
    modelId: t.modelId,
    variant: t.variant,
    taskType: t.taskType,
    resultUrl: t.resultUrl,
    fileId: t.fileId,
    costCredits: t.costCredits,
    billedCredits: t.costCredits != null ? applyGenerationMargin(t.costCredits, marginPercent) : null,
  }));

  const total = await prisma.imageGenerationTask.count({ where: { status: "success" } });

  return NextResponse.json({ items, total });
}
