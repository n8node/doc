import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getProviderForUser } from "@/lib/ai/get-provider-for-user";
import { findSimilar, findSimilarByKeyword } from "@/lib/docling/vector-store";
import { prisma } from "@/lib/prisma";
import {
  assertTokenQuotaAvailable,
  recordTokenUsageEvent,
  TokenQuotaExceededError,
} from "@/lib/ai/token-usage";

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
  const searchByName = request.nextUrl.searchParams.get("searchByName") !== "false";
  const collectionId = request.nextUrl.searchParams.get("collectionId")?.trim() || null;

  let collectionFileIds: string[] | undefined;
  if (collectionId) {
    const collection = await prisma.vectorCollection.findFirst({
      where: { id: collectionId, userId },
      include: { files: { select: { fileId: true } } },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    collectionFileIds = collection.files.map((f) => f.fileId);
    if (collectionFileIds.length === 0) {
      return NextResponse.json({
        results: [],
        query: q,
        provider: "",
        total: 0,
        collectionId,
      });
    }
  }

  const active = await getProviderForUser(userId);
  if (!active) {
    return NextResponse.json(
      { error: "AI-провайдер не настроен. Обратитесь к администратору." },
      { status: 503 },
    );
  }

  try {
    if (!active.usedOwnKey) {
      await assertTokenQuotaAvailable({
        userId,
        category: "SEARCH",
        estimatedTokens: Math.max(32, Math.ceil(q.length / 4)),
      });
    }

    const [keywordResults, semanticResults] = await Promise.all([
      findSimilarByKeyword(userId, q, limit, collectionFileIds),
      (async () => {
        const embResult = await active.provider.generateEmbedding(q);
        const spent = embResult.usage?.totalTokens ?? embResult.usage?.promptTokens ?? 0;
        if (spent > 0) {
          await recordTokenUsageEvent({
            userId,
            category: "SEARCH",
            sourceType: "search",
            sourceId: collectionId ?? undefined,
            tokensIn: embResult.usage?.promptTokens ?? spent,
            tokensTotal: spent,
            provider: active.providerName,
            model: embResult.model ?? undefined,
            isBillable: !active.usedOwnKey,
            metadata: { queryLength: q.length },
          });
        }
        if (embResult.vector.length === 0) return [];
        return findSimilar(embResult.vector, userId, limit, threshold, collectionFileIds);
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
      where: { id: { in: fileIds }, userId, deletedAt: null },
      select: { id: true, name: true, mimeType: true, size: true, folderId: true },
    });
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const chunkResults = merged.slice(0, limit).map((s) => {
      const file = fileMap.get(s.fileId);
      return {
        type: "chunk" as const,
        id: s.id,
        fileId: s.fileId,
        folderId: file?.folderId ?? null,
        fileName: file?.name ?? "Неизвестный файл",
        mimeType: file?.mimeType ?? "",
        fileSize: file?.size != null ? Number(file.size) : 0,
        chunkText: s.chunkText,
        chunkIndex: s.chunkIndex,
        similarity: Math.round(s.similarity * 100) / 100,
        metadata: s.metadata,
      };
    });

    let fileResults: Array<{
      type: "file";
      id: string;
      fileId: string;
      folderId: string | null;
      fileName: string;
      mimeType: string;
      fileSize: number;
      similarity: number;
    }> = [];
    if (searchByName) {
      const words = q.trim().split(/\s+/).filter((w) => w.length >= 2);
      if (words.length > 0) {
        const nameWhere: Prisma.FileWhereInput = {
          userId,
          deletedAt: null,
          OR: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })),
        };
        if (collectionFileIds && collectionFileIds.length > 0) {
          nameWhere.id = { in: collectionFileIds };
        }
        const nameMatches = await prisma.file.findMany({
          where: nameWhere,
          select: { id: true, name: true, mimeType: true, size: true, folderId: true },
          take: limit,
        });
        const chunkFileIds = new Set(chunkResults.map((r) => r.fileId));
        fileResults = nameMatches
          .filter((f) => !chunkFileIds.has(f.id))
          .slice(0, Math.min(limit - chunkResults.length, 10))
          .map((f) => ({
            type: "file" as const,
            id: `file_${f.id}`,
            fileId: f.id,
            folderId: f.folderId,
            fileName: f.name,
            mimeType: f.mimeType,
            fileSize: Number(f.size),
            similarity: 1,
          }));
      }
    }

    const results = [...chunkResults, ...fileResults];

    const response: { results: typeof results; query: string; provider: string; total: number; collectionId?: string } = {
      results,
      query: q,
      provider: active.providerName,
      total: results.length,
    };
    if (collectionId) response.collectionId = collectionId;
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof TokenQuotaExceededError) {
      return NextResponse.json(
        {
          error: "Лимит токенов для поиска по тарифу исчерпан.",
          code: "SEARCH_TOKENS_QUOTA_EXCEEDED",
          quota: error.quota,
          used: error.used,
          requested: error.requested,
        },
        { status: 403 },
      );
    }
    console.error("[Search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка поиска" },
      { status: 500 },
    );
  }
}
