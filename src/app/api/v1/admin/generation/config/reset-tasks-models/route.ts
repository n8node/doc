import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import {
  resetImageGenerationTasksAndModels,
  resetVideoGenerationTasksAndModels,
} from "@/lib/generation/config";

/**
 * POST /api/v1/admin/generation/config/reset-tasks-models
 * Body (optional): { scope?: "image" | "video" | "all" } — по умолчанию только изображения.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let scope: "image" | "video" | "all" = "image";
  try {
    const body = (await request.json()) as { scope?: string };
    if (body?.scope === "video" || body?.scope === "all") scope = body.scope;
  } catch {
    // no body
  }

  if (scope === "image" || scope === "all") {
    await resetImageGenerationTasksAndModels();
  }
  if (scope === "video" || scope === "all") {
    await resetVideoGenerationTasksAndModels();
  }

  return NextResponse.json({ ok: true, scope });
}
