import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveGeneratedVideoToUserStorage } from "@/lib/generation/save-generated-video";
import { parseKieResultJson, firstMediaUrlFromKieTaskResult } from "@/lib/generation/kie-image-client";
import { getPriceCreditsForModel } from "@/lib/generation/kie-pricing-lookup";
import { getGenerationMarginPercent, applyGenerationMargin } from "@/lib/generation/config";
import { applyGenerationBilling } from "@/lib/generation/billing";
import { createNotificationIfEnabled } from "@/lib/notification-service";

/**
 * POST /api/v1/webhooks/kie-video
 * Callback Kie.ai после генерации видео (Market / Kling).
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
      resultJson?: string;
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

  const task = await prisma.videoGenerationTask.findFirst({
    where: { kieTaskId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (body.code !== 200) {
    await prisma.videoGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        errorMessage: body.msg ?? "Generation failed",
      },
    });
    return NextResponse.json({ ok: true });
  }

  const info = body.data?.info;
  let resultUrl: string | null =
    Array.isArray(info?.result_urls) && info.result_urls.length > 0
      ? info.result_urls[0]
      : typeof info?.resultImageUrl === "string"
        ? info.resultImageUrl
        : null;
  if (!resultUrl && typeof body.data?.resultJson === "string") {
    const parsed = parseKieResultJson(body.data.resultJson);
    resultUrl = firstMediaUrlFromKieTaskResult(parsed);
  }

  if (!resultUrl) {
    await prisma.videoGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        errorMessage: "No result URL in callback",
      },
    });
    return NextResponse.json({ ok: true });
  }

  const costCredits = await getPriceCreditsForModel(
    task.modelId,
    task.variant ?? null,
    task.billableDurationSec
  );
  const marginPercent = await getGenerationMarginPercent();
  const billedCredits = costCredits !== null ? applyGenerationMargin(costCredits, marginPercent) : null;

  let fileId: string | null = null;
  try {
    const file = await saveGeneratedVideoToUserStorage({
      userId: task.userId,
      videoUrl: resultUrl,
      fileName: `generated-video-${task.id.slice(-8)}`,
      folderId: null,
    });
    fileId = file.id;
  } catch (err) {
    await prisma.videoGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "success",
        resultUrl,
        errorMessage: err instanceof Error ? err.message : "Failed to save to storage",
        ...(costCredits !== null && { costCredits }),
        ...(billedCredits !== null && { billedCredits }),
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.videoGenerationTask.update({
    where: { id: task.id },
    data: {
      status: "success",
      resultUrl,
      fileId,
      ...(costCredits !== null && { costCredits }),
      ...(billedCredits !== null && { billedCredits }),
    },
  });

  if (billedCredits != null && billedCredits > 0) {
    const billing = await applyGenerationBilling(task.userId, task.id, billedCredits, "video");
    if (!billing.ok) {
      console.warn("[kie-video webhook] Billing failed:", billing.error, "taskId:", task.id);
    }
  }

  await createNotificationIfEnabled({
    userId: task.userId,
    type: "AI_TASK",
    category: "success",
    title: "Генерация видео готова",
    body: "Видео сохранено в «Мои файлы».",
    payload: { fileId, taskId: task.id, resultUrl },
  });

  return NextResponse.json({ ok: true });
}
