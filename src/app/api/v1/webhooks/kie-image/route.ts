import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveGeneratedImageToUserStorage } from "@/lib/generation/save-generated-image";
import { parseKieResultJson } from "@/lib/generation/kie-image-client";
import { getPriceCreditsForModel } from "@/lib/generation/kie-pricing-lookup";
import { getGenerationMarginPercent, applyGenerationMargin } from "@/lib/generation/config";
import { applyGenerationBilling } from "@/lib/generation/billing";

/**
 * POST /api/v1/webhooks/kie-image
 * Callback от Kie.ai после завершения генерации изображения.
 * Сохраняем результат на диск пользователя и обновляем задачу.
 * Стоимость в кредитах берём из таблицы kie_pricing (синхронизация с kie.ai/pricing раз в сутки).
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
  let resultUrl: string | null =
    Array.isArray(info?.result_urls) && info.result_urls.length > 0
      ? info.result_urls[0]
      : typeof info?.resultImageUrl === "string"
        ? info.resultImageUrl
        : null;
  if (!resultUrl && typeof body.data?.resultJson === "string") {
    const parsed = parseKieResultJson(body.data.resultJson);
    resultUrl = parsed.resultUrls?.[0] ?? parsed.resultImageUrl ?? null;
  }

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

  const costCredits = await getPriceCreditsForModel(task.modelId, task.variant ?? null);
  const marginPercent = await getGenerationMarginPercent();
  const billedCredits =
    costCredits !== null ? applyGenerationMargin(costCredits, marginPercent) : null;

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
        ...(costCredits !== null && { costCredits }),
        ...(billedCredits !== null && { billedCredits }),
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
      ...(costCredits !== null && { costCredits }),
      ...(billedCredits !== null && { billedCredits }),
    },
  });

  if (billedCredits != null && billedCredits > 0) {
    const billing = await applyGenerationBilling(task.userId, task.id, billedCredits);
    if (!billing.ok) {
      console.warn("[kie-image webhook] Billing failed:", billing.error, "taskId:", task.id);
    }
  }

  return NextResponse.json({ ok: true });
}
