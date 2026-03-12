import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isProcessable } from "@/lib/docling/processing-service";
import { getDoclingClient } from "@/lib/docling/client";
import { checkDocumentAnalysisAccess } from "@/lib/docling/process-access";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";
import { userUsesOwnKey } from "@/lib/ai/get-provider-for-user";
import { getUserPlan } from "@/lib/plan-service";
import { checkRagMemoryAccess } from "@/lib/rag/access";
import { processVectorizeJob } from "@/lib/rag/vectorize-job";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/rag/collections/[id]/vectorize
 * Starts a background vectorization job. Returns { taskId } immediately.
 * Body (optional): { skipFirst?: number }
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id, userId },
    include: { files: { include: { file: true } } },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Check for an already running vectorize task on this collection
  const existingTask = await prisma.aiTask.findFirst({
    where: {
      userId,
      type: "VECTORIZE",
      status: { in: ["pending", "processing"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingTask) {
    const existingInput = existingTask.input as Record<string, unknown> | null;
    if (existingInput?.collectionId === id) {
      return NextResponse.json({ taskId: existingTask.id, alreadyRunning: true });
    }
  }

  const docling = getDoclingClient();
  const available = await docling.isAvailable();
  if (!available) {
    return NextResponse.json(
      { error: "Сервис обработки документов недоступен" },
      { status: 503 },
    );
  }

  const processableCount = collection.files.filter((f) =>
    isProcessable(f.file.mimeType),
  ).length;

  const docAnalysisError = await checkDocumentAnalysisAccess(
    userId,
    processableCount,
  );
  if (docAnalysisError) return docAnalysisError;

  const usesOwnKey = await userUsesOwnKey(userId);
  if (!usesOwnKey) {
    const plan = await getUserPlan(userId);
    const quota = plan?.embeddingTokensQuota ?? null;
    if (quota != null) {
      const used = await getEmbeddingTokensUsedThisMonth(userId);
      if (used >= quota) {
        return NextResponse.json(
          {
            error: "Лимит токенов на анализ исчерпан",
            code: "EMBEDDING_QUOTA_EXCEEDED",
            used,
            quota,
          },
          { status: 403 },
        );
      }
    }
  }

  let skipFirst = 0;
  try {
    const body = await request.json().catch(() => ({}));
    const v =
      typeof body?.skipFirst === "number" && body.skipFirst >= 0
        ? Math.floor(body.skipFirst)
        : 0;
    skipFirst = Math.min(v, collection.files.length);
  } catch {
    /* ignore */
  }

  const task = await prisma.aiTask.create({
    data: {
      type: "VECTORIZE",
      status: "pending",
      userId,
      input: { collectionId: id, userId, skipFirst },
    },
  });

  // Fire-and-forget: start background processing
  processVectorizeJob(task.id).catch((err) => {
    console.error("[vectorize] Background job failed:", err);
  });

  return NextResponse.json({ taskId: task.id });
}
