import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import { getPublicBaseUrl } from "@/lib/app-url";
import { getPresignedDownloadUrl } from "@/lib/s3-download";
import {
  create4oImageTask,
  createFluxImageTask,
  createMarketTask,
} from "@/lib/generation/kie-image-client";
import { getKieModelForMarket, buildMarketInput } from "@/lib/generation/kie-market-models";

const KIE_LIMIT_PER_RUN = 20;

type QueuePayload = {
  taskType?: string;
  modelId?: string;
  prompt?: string;
  fileIds?: string[];
  maskFileId?: string | null;
  size?: string;
  aspectRatio?: string;
  outputFormat?: string;
  fluxModel?: string;
  resolution?: string;
  quality?: string;
  strength?: number;
  negativePrompt?: string;
  seed?: number;
  numImages?: number;
  acceleration?: string;
};

/**
 * POST /api/v1/cron/process-image-generation-queue
 * Обрабатывает до 20 задач из очереди (лимит Kie: 20 запросов / 10 сек). Вызывать по крону каждые ~10 сек.
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getKieApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Kie API key not configured" }, { status: 503 });
  }

  const baseUrl = getPublicBaseUrl();
  const callBackUrl = `${baseUrl}/api/v1/webhooks/kie-image`;

  const queueRows = await prisma.imageGenerationQueue.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: KIE_LIMIT_PER_RUN,
  });

  let sent = 0;
  let rateLimited = false;

  for (const row of queueRows) {
    if (rateLimited) break;

    const task = await prisma.imageGenerationTask.findUnique({
      where: { id: row.taskId },
    });
    if (!task || task.status !== "queued") {
      await prisma.imageGenerationQueue.update({
        where: { id: row.id },
        data: { status: "sent" },
      });
      continue;
    }

    const payload = row.payload as QueuePayload;
    const userId = task.userId;
    const modelId = payload.modelId ?? task.modelId;
    const taskType = payload.taskType ?? task.taskType;
    const prompt = payload.prompt ?? "";
    const fileIds = Array.isArray(payload.fileIds) ? payload.fileIds : [];
    const maskFileId = payload.maskFileId ?? null;

    const getFileUrl = async (fileId: string): Promise<string> => {
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId, deletedAt: null },
        select: { s3Key: true },
      });
      if (!file) throw new Error("File not found");
      return getPresignedDownloadUrl(file.s3Key, 3600);
    };

    let result: { taskId: string } | { error: string; rateLimit?: boolean };

    try {
      if (row.kind === "4o") {
        const size = (payload.size as "1:1" | "3:2" | "2:3") ?? "1:1";
        let filesUrl: string[] | undefined;
        if (fileIds.length > 0) {
          filesUrl = await Promise.all(fileIds.map(getFileUrl));
        }
        let maskUrl: string | undefined;
        if (maskFileId) maskUrl = await getFileUrl(maskFileId);
        result = await create4oImageTask(apiKey, {
          prompt: prompt || undefined,
          filesUrl,
          size,
          maskUrl,
          callBackUrl,
        });
      } else if (row.kind === "flux") {
        let inputImage: string | undefined;
        if (fileIds.length > 0) inputImage = await getFileUrl(fileIds[0]);
        result = await createFluxImageTask(apiKey, {
          prompt,
          inputImage,
          aspectRatio: (payload.aspectRatio as "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16") ?? "16:9",
          outputFormat: payload.outputFormat === "png" ? "png" : "jpeg",
          model: payload.fluxModel === "flux-kontext-max" ? "flux-kontext-max" : "flux-kontext-pro",
          callBackUrl,
          enableTranslation: true,
        });
      } else {
        const kieModel = getKieModelForMarket(modelId);
        if (!kieModel) {
          result = { error: "Unknown model" };
        } else {
          let fileUrls: string[] = [];
          if (fileIds.length > 0) {
            fileUrls = await Promise.all(fileIds.map(getFileUrl));
          }
          const inputOrError = buildMarketInput({
            modelId,
            taskType,
            prompt,
            fileUrls,
            aspectRatio: payload.aspectRatio ?? "1:1",
            resolution: payload.resolution ?? "1K",
            outputFormat: payload.outputFormat ?? "png",
            size: payload.size ?? "1:1",
            quality: payload.quality ?? "medium",
            strength: payload.strength,
            negativePrompt: payload.negativePrompt,
            seed: payload.seed,
            numImages: payload.numImages,
            acceleration: payload.acceleration,
          });
          if ("error" in inputOrError) {
            result = { error: String(inputOrError.error) };
          } else {
            result = await createMarketTask(apiKey, {
              model: kieModel,
              input: inputOrError,
              callBackUrl,
            });
          }
        }
      }
    } catch (e) {
      console.warn("[process-image-generation-queue] Error processing queue row:", row.id, e);
      continue;
    }

    if ("rateLimit" in result && result.rateLimit) {
      rateLimited = true;
      break;
    }

    if ("error" in result) {
      continue;
    }

    await prisma.$transaction([
      prisma.imageGenerationTask.update({
        where: { id: task.id },
        data: { kieTaskId: result.taskId, status: "processing" },
      }),
      prisma.imageGenerationQueue.update({
        where: { id: row.id },
        data: { status: "sent" },
      }),
    ]);
    sent++;
  }

  return NextResponse.json({ ok: true, processed: queueRows.length, sent });
}
