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
  getGenerationMarginPercent,
  setGenerationMarginPercent,
  type ImageTaskConfig,
  type ImageModelConfig,
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

  const [imageEnabled, imageTasks, imageModels, marginPercent] = await Promise.all([
    getImageGenerationEnabled(),
    getImageTasksConfig(),
    getImageModelsConfig(),
    getGenerationMarginPercent(),
  ]);

  return NextResponse.json({
    imageEnabled,
    imageTasks,
    imageModels,
    marginPercent,
  });
}

/**
 * PUT /api/v1/admin/generation/config
 * Обновить конфиг генерации.
 * Body: { imageEnabled?, imageTasks?, imageModels?, marginPercent? }
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
    imageTasks?: ImageTaskConfig[];
    imageModels?: ImageModelConfig[];
    marginPercent?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.imageEnabled === "boolean") {
    await setImageGenerationEnabled(body.imageEnabled);
  }
  if (Array.isArray(body.imageTasks)) {
    await setImageTasksConfig(body.imageTasks);
  }
  if (Array.isArray(body.imageModels)) {
    await setImageModelsConfig(body.imageModels);
  }
  if (typeof body.marginPercent === "number") {
    await setGenerationMarginPercent(body.marginPercent);
  }

  return NextResponse.json({ ok: true });
}
