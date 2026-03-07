import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@/lib/admin-guard";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function modelDisplayName(raw: string): string {
  const s = raw?.trim() || "";
  if (s === "docling" || s === "Docling") return "QoQon";
  if (s === "openai_whisper" || s === "OpenAI") return "OpenAI";
  return s || "—";
}

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

  const tasks = await prisma.aiTask.findMany({
    where: {
      type: { in: ["TRANSCRIPTION", "CHAT", "EMBEDDING"] },
      status: "completed",
      completedAt: { gte: since },
    },
    select: {
      type: true,
      output: true,
      userId: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const transcriptionByModel = new Map<string, { minutes: number; tasks: number }>();
  const transcriptionByUser = new Map<string, { minutes: number; tasks: number; email: string; name: string | null }>();
  let transcriptionTotal = 0;

  const chatByModel = new Map<string, { tokens: number; tasks: number }>();
  const chatByUser = new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>();
  let chatTotal = 0;

  const embeddingByModel = new Map<string, { tokens: number; tasks: number }>();
  const embeddingByUser = new Map<string, { tokens: number; tasks: number; email: string; name: string | null }>();
  let embeddingTotal = 0;

  for (const t of tasks) {
    const out = (t.output as Record<string, unknown>) ?? {};

    if (t.type === "TRANSCRIPTION") {
      const minutes = Number(out.minutesUsed) || 0;
      if (minutes <= 0) continue;
      transcriptionTotal += minutes;
      const modelRaw = (out.modelName as string) ?? (out.provider as string) ?? "—";
      const model = modelDisplayName(String(modelRaw));
      const cur = transcriptionByModel.get(model) ?? { minutes: 0, tasks: 0 };
      cur.minutes += minutes;
      cur.tasks += 1;
      transcriptionByModel.set(model, cur);

      const uid = t.userId;
      const ucur = transcriptionByUser.get(uid) ?? {
        minutes: 0,
        tasks: 0,
        email: t.user.email,
        name: t.user.name,
      };
      ucur.minutes += minutes;
      ucur.tasks += 1;
      transcriptionByUser.set(uid, ucur);
    } else if (t.type === "CHAT") {
      const tokens =
        Number(out.totalTokens) ??
        (Number(out.promptTokens) || 0) + (Number(out.completionTokens) || 0);
      if (tokens <= 0) continue;
      chatTotal += tokens;
      const model = modelDisplayName(String(out.model ?? "—"));
      const cur = chatByModel.get(model) ?? { tokens: 0, tasks: 0 };
      cur.tokens += tokens;
      cur.tasks += 1;
      chatByModel.set(model, cur);

      const uid = t.userId;
      const ucur = chatByUser.get(uid) ?? {
        tokens: 0,
        tasks: 0,
        email: t.user.email,
        name: t.user.name,
      };
      ucur.tokens += tokens;
      ucur.tasks += 1;
      chatByUser.set(uid, ucur);
    } else if (t.type === "EMBEDDING") {
      const tokens = Number(out.tokensUsed) ?? Number(out.promptTokens) ?? 0;
      if (tokens <= 0) continue;
      embeddingTotal += tokens;
      const model = modelDisplayName(String(out.modelName ?? out.providerName ?? "—"));
      const cur = embeddingByModel.get(model) ?? { tokens: 0, tasks: 0 };
      cur.tokens += tokens;
      cur.tasks += 1;
      embeddingByModel.set(model, cur);

      const uid = t.userId;
      const ucur = embeddingByUser.get(uid) ?? {
        tokens: 0,
        tasks: 0,
        email: t.user.email,
        name: t.user.name,
      };
      ucur.tokens += tokens;
      ucur.tasks += 1;
      embeddingByUser.set(uid, ucur);
    }
  }

  const byModel = <T,>(map: Map<string, T>) =>
    Array.from(map.entries()).map(([model, data]) => ({ model, ...data }));

  const byUser = (
    map: Map<string, { minutes?: number; tokens?: number; tasks: number; email: string; name: string | null }>,
  ) =>
    Array.from(map.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => {
        const va = (a as { minutes?: number; tokens?: number }).minutes ?? (a as { tokens?: number }).tokens ?? 0;
        const vb = (b as { minutes?: number; tokens?: number }).minutes ?? (b as { tokens?: number }).tokens ?? 0;
        return vb - va;
      });

  return NextResponse.json({
    periodDays: days,
    since: since.toISOString(),
    transcription: {
      totalMinutes: transcriptionTotal,
      byModel: byModel(transcriptionByModel),
      byUser: byUser(transcriptionByUser),
    },
    chat: {
      totalTokens: chatTotal,
      byModel: byModel(chatByModel),
      byUser: byUser(chatByUser),
    },
    embedding: {
      totalTokens: embeddingTotal,
      byModel: byModel(embeddingByModel),
      byUser: byUser(embeddingByUser),
    },
  });
}
