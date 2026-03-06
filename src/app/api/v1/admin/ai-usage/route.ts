import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AiTaskOutput = { tokensUsed?: number; promptTokens?: number; minutesUsed?: number } | null;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));
  const type = url.searchParams.get("type") || ""; // EMBEDDING | TRANSCRIPTION
  const userSearch = url.searchParams.get("user")?.trim() || "";
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const completedAtFilter: { not: null; gte?: Date; lte?: Date } = { not: null };
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!isNaN(d.getTime())) completedAtFilter.gte = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      completedAtFilter.lte = d;
    }
  }

  const taskType = type === "TRANSCRIPTION" ? "TRANSCRIPTION" : type === "EMBEDDING" ? "EMBEDDING" : null;

  const where: Prisma.AiTaskWhereInput = {
    type: taskType ?? { in: ["EMBEDDING", "TRANSCRIPTION"] },
    status: "completed",
    completedAt: completedAtFilter,
  };

  if (userSearch) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: userSearch, mode: "insensitive" } },
          { name: { contains: userSearch, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    where.userId = userIds.length > 0 ? { in: userIds } : { in: [] };
  }

  const [tasks, total] = await Promise.all([
    prisma.aiTask.findMany({
      where,
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        output: true,
        completedAt: true,
        userId: true,
        fileId: true,
        providerId: true,
        user: { select: { id: true, email: true, name: true } },
        file: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
      },
    }),
    prisma.aiTask.count({ where }),
  ]);

  const items = tasks.map((t) => {
    const out = (t.output as AiTaskOutput) ?? {};
    const tokens = t.type === "EMBEDDING" ? (out.tokensUsed ?? out.promptTokens ?? 0) : 0;
    const minutes = t.type === "TRANSCRIPTION" ? (out.minutesUsed ?? 0) : 0;
    return {
      id: t.id,
      type: t.type,
      amount: tokens || minutes,
      unit: t.type === "EMBEDDING" ? "tokens" : "minutes",
      completedAt: t.completedAt?.toISOString() ?? null,
      user: t.user,
      file: t.file,
      provider: t.provider,
    };
  });

  return NextResponse.json({
    items,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  });
}
