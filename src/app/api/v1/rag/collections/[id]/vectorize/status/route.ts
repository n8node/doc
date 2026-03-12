import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { checkRagMemoryAccess } from "@/lib/rag/access";
import type { VectorizeJobProgress } from "@/lib/rag/vectorize-job";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rag/collections/[id]/vectorize/status?taskId=...
 * Returns the current status of a vectorize job.
 * If no taskId, returns the latest active vectorize task for this collection.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessError = await checkRagMemoryAccess(userId);
  if (accessError) return accessError;

  const { id: collectionId } = await ctx.params;
  const taskId = request.nextUrl.searchParams.get("taskId");

  let task;
  if (taskId) {
    task = await prisma.aiTask.findFirst({
      where: { id: taskId, userId, type: "VECTORIZE" },
    });
  } else {
    task = await prisma.aiTask.findFirst({
      where: {
        userId,
        type: "VECTORIZE",
        status: { in: ["pending", "processing"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (task) {
      const input = task.input as Record<string, unknown> | null;
      if (input?.collectionId !== collectionId) task = null;
    }
  }

  if (!task) {
    return NextResponse.json({ status: "idle" });
  }

  const progress = (task.output ?? null) as VectorizeJobProgress | null;

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
    progress,
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
  });
}
