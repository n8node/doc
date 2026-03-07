import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getProviderForUser } from "@/lib/ai/get-provider-for-user";
import { findSimilar, findSimilarByKeyword } from "@/lib/docling/vector-store";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Запрос слишком короткий" }, { status: 400 });
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10),
    50,
  );
  const threshold = parseFloat(
    request.nextUrl.searchParams.get("threshold") ?? "0.55",
  );

  const active = await getProviderForUser(userId);
  if (!active) {
    return NextResponse.json(
      { error: "AI-провайдер не настроен. Обратитесь к администратору." },
      { status: 503 },
    );
  }

  try {
    const [keywordResults, semanticResults] = await Promise.all([
      findSimilarByKeyword(userId, q, limit),
      (async () => {
        const embResult = await active.provider.generateEmbedding(q);
        if (embResult.vector.length === 0) return [];
        return findSimilar(embResult.vector, userId, limit, threshold);
      })(),
    ]);

    const seen = new Set<string>();
    const merged: Array<{
      id: string;
      fileId: string;
      chunkText: string;
      chunkIndex: number;
      similarity: number;
      metadata: Record<string, unknown> | null;
      fromKeyword: boolean;
    }> = [];
    for (const s of keywordResults) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push({ ...s, fromKeyword: true });
      }
    }
    for (const s of semanticResults) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push({ ...s, fromKeyword: false });
      }
      if (merged.length >= limit) break;
    }

    const fileIds = Array.from(new Set(merged.map((s) => s.fileId)));
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, name: true, mimeType: true, size: true },
    });
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const results = merged.slice(0, limit).map((s) => {
      const file = fileMap.get(s.fileId);
      return {
        id: s.id,
        fileId: s.fileId,
        fileName: file?.name ?? "Неизвестный файл",
        mimeType: file?.mimeType ?? "",
        fileSize: file?.size != null ? Number(file.size) : 0,
        chunkText: s.chunkText,
        chunkIndex: s.chunkIndex,
        similarity: Math.round(s.similarity * 100) / 100,
        metadata: s.metadata,
      };
    });

    return NextResponse.json({
      results,
      query: q,
      provider: active.providerName,
      total: results.length,
    });
  } catch (error) {
    console.error("[Search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка поиска" },
      { status: 500 },
    );
  }
}
