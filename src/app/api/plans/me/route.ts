import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getUserPlan } from "@/lib/plan-service";
import { getEmbeddingTokensUsedThisMonth } from "@/lib/ai/embedding-usage";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(userId);
  if (!plan)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const embeddingTokensUsedThisMonth =
    plan.embeddingTokensQuota != null
      ? await getEmbeddingTokensUsedThisMonth(userId)
      : undefined;

  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
    maxFileSize: Number(plan.maxFileSize),
    embeddingTokensUsedThisMonth,
  });
}
