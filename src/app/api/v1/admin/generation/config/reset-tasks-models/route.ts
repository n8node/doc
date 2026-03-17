import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { resetImageGenerationTasksAndModels } from "@/lib/generation/config";

/**
 * POST /api/v1/admin/generation/config/reset-tasks-models
 * Сбросить задачи и модели к умолчанию (появится полный список из кода, в т.ч. все Market-модели).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await resetImageGenerationTasksAndModels();
  return NextResponse.json({ ok: true });
}
