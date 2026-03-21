import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : null;
  if (!orderedIds || !orderedIds.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "Нужен массив orderedIds" }, { status: 400 });
  }

  const existing = await prisma.roadmapStep.findMany({ select: { id: true } });
  const idSet = new Set(existing.map((e) => e.id));
  if (orderedIds.length !== idSet.size || orderedIds.some((id: string) => !idSet.has(id))) {
    return NextResponse.json({ error: "Неверный набор id" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((id: string, index: number) =>
      prisma.roadmapStep.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  const steps = await prisma.roadmapStep.findMany({
    orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ steps });
}
