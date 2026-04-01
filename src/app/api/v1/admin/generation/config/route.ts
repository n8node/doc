import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getImageGenerationEnabled,
  setImageGenerationEnabled,
  getImageTasksConfig,
  setImageTasksConfig,
  getImageModelsConfig,
  setImageModelsConfig,
  getVideoGenerationEnabled,
  setVideoGenerationEnabled,
  getVideoTasksConfig,
  setVideoTasksConfig,
  getVideoModelsConfig,
  setVideoModelsConfig,
  getGenerationMarginPercent,
  setGenerationMarginPercent,
  getGenerationKopecksPerCredit,
  setGenerationKopecksPerCredit,
  getVideoPricingFormula,
  setVideoPricingFormula,
  type ImageTaskConfig,
  type ImageModelConfig,
  type VideoTaskConfig,
  type VideoModelConfig,
  type VideoPricingFormulaConfig,
} from "@/lib/generation/config";

/**
 * GET /api/v1/admin/generation/config
 * Текущий конфиг генерации (без API-ключа).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [imageEnabled, imageTasks, imageModels, videoEnabled, videoTasks, videoModels, marginPercent, kopecksPerCredit, videoPricingFormula] =
    await Promise.all([
      getImageGenerationEnabled(),
      getImageTasksConfig(),
      getImageModelsConfig(),
      getVideoGenerationEnabled(),
      getVideoTasksConfig(),
      getVideoModelsConfig(),
      getGenerationMarginPercent(),
      getGenerationKopecksPerCredit(),
      getVideoPricingFormula(),
    ]);

  return NextResponse.json({
    imageEnabled,
    imageTasks,
    imageModels,
    videoEnabled,
    videoTasks,
    videoModels,
    marginPercent,
    kopecksPerCredit,
    videoPricingFormula,
  });
}

/**
 * PUT /api/v1/admin/generation/config
 * Обновить конфиг генерации.
 * Body: { ... , videoPricingFormula? }
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    imageEnabled?: boolean;
    videoEnabled?: boolean;
    imageTasks?: ImageTaskConfig[];
    imageModels?: ImageModelConfig[];
    videoTasks?: VideoTaskConfig[];
    videoModels?: VideoModelConfig[];
    marginPercent?: number;
    kopecksPerCredit?: number;
    videoPricingFormula?: VideoPricingFormulaConfig;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.imageEnabled === "boolean") {
    await setImageGenerationEnabled(body.imageEnabled);
  }
  if (typeof body.videoEnabled === "boolean") {
    await setVideoGenerationEnabled(body.videoEnabled);
  }
  if (Array.isArray(body.imageTasks)) {
    await setImageTasksConfig(body.imageTasks);
  }
  if (Array.isArray(body.imageModels)) {
    await setImageModelsConfig(body.imageModels);
  }
  if (Array.isArray(body.videoTasks)) {
    await setVideoTasksConfig(body.videoTasks);
  }
  if (Array.isArray(body.videoModels)) {
    await setVideoModelsConfig(body.videoModels);
  }
  if (typeof body.marginPercent === "number") {
    await setGenerationMarginPercent(body.marginPercent);
  }
  if (typeof body.kopecksPerCredit === "number") {
    await setGenerationKopecksPerCredit(body.kopecksPerCredit);
  }
  if (body.videoPricingFormula != null && typeof body.videoPricingFormula === "object") {
    await setVideoPricingFormula(body.videoPricingFormula);
  }

  return NextResponse.json({ ok: true });
}
