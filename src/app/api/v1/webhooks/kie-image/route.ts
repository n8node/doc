import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveGeneratedImageToUserStorage } from "@/lib/generation/save-generated-image";

/**
 * POST /api/v1/webhooks/kie-image
 * Callback от Kie.ai после завершения генерации изображения.
 * Сохраняем результат на диск пользователя и обновляем задачу.
 */
export async function POST(request: NextRequest) {
  let body: {
    code?: number;
    msg?: string;
    data?: {
      taskId?: string;
      info?: {
        result_urls?: string[];
        resultImageUrl?: string;
      };
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kieTaskId = body.data?.taskId;
  if (!kieTaskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const task = await prisma.imageGenerationTask.findFirst({
    where: { kieTaskId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (body.code !== 200) {
    await prisma.imageGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        errorMessage: body.msg ?? "Generation failed",
      },
    });
    return NextResponse.json({ ok: true });
  }

  const info = body.data?.info;
  const resultUrls = info?.result_urls;
  const resultImageUrl = info?.resultImageUrl;
  const resultUrl = Array.isArray(resultUrls) && resultUrls.length > 0
    ? resultUrls[0]
    : typeof resultImageUrl === "string"
      ? resultImageUrl
      : null;

  if (!resultUrl) {
    await prisma.imageGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        errorMessage: "No result URL in callback",
      },
    });
    return NextResponse.json({ ok: true });
  }

  let fileId: string | null = null;
  try {
    const file = await saveGeneratedImageToUserStorage({
      userId: task.userId,
      imageUrl: resultUrl,
      fileName: `generated-${task.id.slice(-8)}`,
      folderId: null,
    });
    fileId = file.id;
  } catch (err) {
    await prisma.imageGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "success",
        resultUrl,
        errorMessage: err instanceof Error ? err.message : "Failed to save to storage",
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.imageGenerationTask.update({
    where: { id: task.id },
    data: {
      status: "success",
      resultUrl,
      fileId,
    },
  });

  return NextResponse.json({ ok: true });
}
