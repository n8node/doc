import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveProvider } from "@/lib/ai/get-active-provider";
import { findSimilar } from "@/lib/docling/vector-store";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
    request.nextUrl.searchParams.get("threshold") ?? "0.3",
  );

  const active = await getActiveProvider();
  if (!active) {
    return NextResponse.json(
      { error: "AI-провайдер не настроен. Обратитесь к администратору." },
      { status: 503 },
    );
  }

  try {
    const embResult = await active.provider.generateEmbedding(q);
    if (embResult.vector.length === 0) {
      return NextResponse.json({ results: [], query: q });
    }

    const similar = await findSimilar(
      embResult.vector,
      session.user.id,
      limit,
      threshold,
    );

    const fileIds = Array.from(new Set(similar.map((s) => s.fileId)));
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, name: true, mimeType: true, size: true },
    });
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const results = similar.map((s) => {
      const file = fileMap.get(s.fileId);
      return {
        id: s.id,
        fileId: s.fileId,
        fileName: file?.name ?? "Неизвестный файл",
        mimeType: file?.mimeType ?? "",
        fileSize: file?.size ?? 0,
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
