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

  const period = request.nextUrl.searchParams.get("period") ?? "30";
  const days = Math.min(365, Math.max(1, parseInt(period, 10) || 30));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.tokenUsageEvent.findMany({
    where: {
      isBillable: true,
      createdAt: { gte: since },
    },
    select: {
      category: true,
      model: true,
      tokensTotal: true,
      userId: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const byCategory = {
    CHAT_DOCUMENT: {
      totalTokens: 0,
      byModel: new Map<string, { tokens: number; tasks: number }>(),
      byUser: new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>(),
    },
    SEARCH: {
      totalTokens: 0,
      byModel: new Map<string, { tokens: number; tasks: number }>(),
      byUser: new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>(),
    },
    EMBEDDING: {
      totalTokens: 0,
      byModel: new Map<string, { tokens: number; tasks: number }>(),
      byUser: new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>(),
    },
    TRANSCRIPTION: {
      totalTokens: 0,
      byModel: new Map<string, { tokens: number; tasks: number }>(),
      byUser: new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>(),
    },
  };

  for (const event of events) {
    const entry = byCategory[event.category];
    const tokens = Number(event.tokensTotal) || 0;
    if (tokens <= 0) continue;

    entry.totalTokens += tokens;
    const model = event.model?.trim() || "—";
    const modelCur = entry.byModel.get(model) ?? { tokens: 0, tasks: 0 };
    modelCur.tokens += tokens;
    modelCur.tasks += 1;
    entry.byModel.set(model, modelCur);

    const userCur = entry.byUser.get(event.userId) ?? {
      tokens: 0,
      tasks: 0,
      email: event.user.email,
      name: event.user.name,
    };
    userCur.tokens += tokens;
    userCur.tasks += 1;
    entry.byUser.set(event.userId, userCur);
  }

  const byModel = <T extends object>(map: Map<string, T>) =>
    Array.from(map.entries()).map(([model, data]) => ({ model, ...data }));

  const byUser = (
    map: Map<string, { tokens: number; tasks: number; email: string; name: string | null }>,
  ) =>
    Array.from(map.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.tokens - a.tokens);

  return NextResponse.json({
    periodDays: days,
    since: since.toISOString(),
    chatDocument: {
      totalTokens: byCategory.CHAT_DOCUMENT.totalTokens,
      byModel: byModel(byCategory.CHAT_DOCUMENT.byModel),
      byUser: byUser(byCategory.CHAT_DOCUMENT.byUser),
    },
    search: {
      totalTokens: byCategory.SEARCH.totalTokens,
      byModel: byModel(byCategory.SEARCH.byModel),
      byUser: byUser(byCategory.SEARCH.byUser),
    },
    embedding: {
      totalTokens: byCategory.EMBEDDING.totalTokens,
      byModel: byModel(byCategory.EMBEDDING.byModel),
      byUser: byUser(byCategory.EMBEDDING.byUser),
    },
    transcription: {
      totalTokens: byCategory.TRANSCRIPTION.totalTokens,
      byModel: byModel(byCategory.TRANSCRIPTION.byModel),
      byUser: byUser(byCategory.TRANSCRIPTION.byUser),
    },
  });
}
