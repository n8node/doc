import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import { getKieTaskRecord, parseKieResultJson } from "@/lib/generation/kie-image-client";
import { getGenerationMarginPercent, applyGenerationMargin } from "@/lib/generation/config";
import { getPriceCreditsForModel } from "@/lib/generation/kie-pricing-lookup";

/**
 * GET /api/v1/generate/image/status?taskId=...
 * Статус задачи генерации. При status=processing опционально опрашивает Kie.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const task = await prisma.imageGenerationTask.findFirst({
    where: { id: taskId, userId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status === "queued" || task.kieTaskId == null) {
    return NextResponse.json({
      taskId: task.id,
      status: "queued",
    });
  }

  if (task.status === "success") {
    const billedCredits =
      task.billedCredits ?? (task.costCredits != null ? applyGenerationMargin(task.costCredits, await getGenerationMarginPercent()) : null);
    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      resultUrl: task.resultUrl,
      fileId: task.fileId,
      costCredits: task.costCredits,
      billedCredits,
    });
  }

  if (task.status === "failed") {
    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      errorMessage: task.errorMessage,
    });
  }

  // processing / pending: опционально опросить Kie
  const apiKey = await getKieApiKey();
  if (apiKey && task.kieTaskId) {
    const record = await getKieTaskRecord(apiKey, task.kieTaskId);
    if (record) {
      if (record.state === "success" && record.resultJson) {
        const parsed = parseKieResultJson(record.resultJson);
        const resultUrl = parsed.resultUrls?.[0] ?? parsed.resultImageUrl;
        if (resultUrl) {
          const costCredits = await getPriceCreditsForModel(task.modelId, task.variant ?? null);
          const marginPercent = await getGenerationMarginPercent();
          const billedCredits = costCredits != null ? applyGenerationMargin(costCredits, marginPercent) : null;
          await prisma.imageGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "success",
              resultUrl,
              ...(costCredits !== null && { costCredits }),
              ...(billedCredits !== null && { billedCredits }),
            },
          });
          return NextResponse.json({
            taskId: task.id,
            status: "success",
            resultUrl,
            fileId: task.fileId,
            costCredits,
            billedCredits,
          });
        }
      } else if (record.state === "fail") {
        await prisma.imageGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "failed",
            errorMessage: record.failMsg ?? "Generation failed",
          },
        });
        return NextResponse.json({
          taskId: task.id,
          status: "failed",
          errorMessage: record.failMsg ?? "Generation failed",
        });
      }
    }
  }

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
  });
}
