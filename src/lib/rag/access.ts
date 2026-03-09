import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/plan-service";

type RagQuotaStatus = {
  quota: number | null;
  used: number;
  available: number | null;
};

export async function checkRagMemoryAccess(userId: string): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId);
  if (!plan) return null;

  const features = (plan.features ?? {}) as Record<string, unknown>;
  if (features.rag_memory !== true) {
    return NextResponse.json(
      {
        error: "RAG-память недоступна на вашем тарифе. Обновите тариф для доступа.",
        code: "RAG_MEMORY_DISABLED",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function getRagDocumentsQuotaStatus(
  userId: string,
  options?: { excludeCollectionId?: string }
): Promise<RagQuotaStatus> {
  const plan = await getUserPlan(userId);
  const quota = plan?.ragDocumentsQuota ?? null;

  const used = await prisma.vectorCollectionFile.count({
    where: {
      collection: {
        userId,
        ...(options?.excludeCollectionId
          ? { id: { not: options.excludeCollectionId } }
          : {}),
      },
    },
  });

  return {
    quota,
    used,
    available: quota == null ? null : Math.max(0, quota - used),
  };
}
