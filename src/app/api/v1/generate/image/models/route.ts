import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { hasFeature } from "@/lib/plan-service";
import { getImageGenerationEnabled, getImageModelsConfig } from "@/lib/generation/config";

/**
 * GET /api/v1/generate/image/models?taskId=...
 * Список моделей для выбранной задачи (taskId = тип задачи: text_to_image, edit_image, variations).
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await hasFeature(userId, "content_generation");
  if (!canGenerate) {
    return NextResponse.json({ error: "Тариф не включает генерацию изображений" }, { status: 403 });
  }

  const enabled = await getImageGenerationEnabled();
  if (!enabled) {
    return NextResponse.json({ models: [] });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") ?? "";

  const models = await getImageModelsConfig();
  const list = models
    .filter((m) => m.enabled && m.taskIds.includes(taskId))
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));

  return NextResponse.json({ models: list });
}
