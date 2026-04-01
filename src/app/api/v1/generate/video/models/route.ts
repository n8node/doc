import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { hasFeature } from "@/lib/plan-service";
import { getVideoGenerationEnabled, getVideoModelsConfig } from "@/lib/generation/config";

/**
 * GET /api/v1/generate/video/models?taskId=...
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await hasFeature(userId, "video_generation");
  if (!canGenerate) {
    return NextResponse.json({ error: "Тариф не включает генерацию видео" }, { status: 403 });
  }

  const enabled = await getVideoGenerationEnabled();
  if (!enabled) {
    return NextResponse.json({ models: [] });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") ?? "";
  if (!taskId) {
    return NextResponse.json({ models: [] });
  }

  const models = await getVideoModelsConfig();
  const list = models
    .filter((m) => m.enabled && m.taskIds.includes(taskId))
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      id: m.id,
      name: (m.displayName?.trim() || m.name).trim(),
      description: m.description,
    }));

  return NextResponse.json({ models: list });
}
