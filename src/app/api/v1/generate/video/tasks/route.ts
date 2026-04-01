import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { hasFeature } from "@/lib/plan-service";
import { getVideoGenerationEnabled, getVideoTasksConfig } from "@/lib/generation/config";

/**
 * GET /api/v1/generate/video/tasks
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
    return NextResponse.json({ tasks: [] });
  }

  const tasks = await getVideoTasksConfig();
  const list = tasks
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ id: t.id, label: t.label }));

  return NextResponse.json({ tasks: list });
}
