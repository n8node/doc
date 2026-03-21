import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { parseIsoDateInput } from "@/lib/roadmap-date-format";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps = await prisma.roadmapStep.findMany({
    orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ steps });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const completed = typeof body.completed === "boolean" ? body.completed : false;
  const targetDate =
    typeof body.targetDate === "string" ? parseIsoDateInput(body.targetDate) : null;

  if (!title || !targetDate) {
    return NextResponse.json({ error: "Укажите название и дату" }, { status: 400 });
  }

  const maxOrder = await prisma.roadmapStep.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const step = await prisma.roadmapStep.create({
    data: { title, targetDate, sortOrder, completed },
  });

  return NextResponse.json(step);
}
