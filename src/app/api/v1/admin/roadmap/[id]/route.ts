import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { parseIsoDateInput } from "@/lib/roadmap-date-format";
import { prisma } from "@/lib/prisma";

async function renormalizeSortOrder() {
  const rows = await prisma.roadmapStep.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    rows.map((r, index) =>
      prisma.roadmapStep.update({
        where: { id: r.id },
        data: { sortOrder: index },
      })
    )
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: {
    title?: string;
    targetDate?: Date;
    completed?: boolean;
  } = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.targetDate === "string") {
    const d = parseIsoDateInput(body.targetDate);
    if (!d) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
    data.targetDate = d;
  }
  if (typeof body.completed === "boolean") data.completed = body.completed;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  if (data.title !== undefined && !data.title) {
    return NextResponse.json({ error: "Пустой заголовок" }, { status: 400 });
  }

  try {
    const step = await prisma.roadmapStep.update({
      where: { id },
      data,
    });
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.roadmapStep.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  await renormalizeSortOrder();
  const steps = await prisma.roadmapStep.findMany({
    orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ steps });
}
