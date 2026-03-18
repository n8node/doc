import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { hasFeature, getUserPlan } from "@/lib/plan-service";
import { getImageGenerationEnabled, getImageTasksConfig, getImageModelsConfig } from "@/lib/generation/config";
import { getImageGenerationCreditsUsedThisMonth } from "@/lib/generation/billing";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import {
  create4oImageTask,
  createFluxImageTask,
  createMarketTask,
  KIE_RATE_LIMIT_MESSAGE,
} from "@/lib/generation/kie-image-client";
import { isMarketModel, getKieModelForMarket, buildMarketInput } from "@/lib/generation/kie-market-models";
import { getPublicBaseUrl } from "@/lib/app-url";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await hasFeature(userId, "content_generation");
  if (!canGenerate) {
    return NextResponse.json(
      { error: "Тариф не включает генерацию изображений" },
      { status: 403 }
    );
  }

  const enabled = await getImageGenerationEnabled();
  if (!enabled) {
    return NextResponse.json(
      { error: "Генерация изображений временно отключена" },
      { status: 503 }
    );
  }

  const apiKey = await getKieApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Сервис генерации не настроен. Обратитесь к администратору." },
      { status: 503 }
    );
  }

  const [plan, usedCreditsThisMonth, user] = await Promise.all([
    getUserPlan(userId),
    getImageGenerationCreditsUsedThisMonth(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { llmWalletBalanceCents: true } }),
  ]);
  const quota = plan?.imageGenerationCreditsQuota;
  const remainingQuota = quota != null ? Math.max(0, quota - usedCreditsThisMonth) : null;
  const balanceCents = user?.llmWalletBalanceCents ?? 0;
  const canUseQuota = remainingQuota === null || remainingQuota > 0;
  if (!canUseQuota && balanceCents <= 0) {
    return NextResponse.json(
      { error: "Исчерпана квота генерации по тарифу. Пополните кошелёк для доплаты или смените тариф." },
      { status: 403 }
    );
  }

  let body: {
    taskType?: string;
    modelId?: string;
    prompt?: string;
    fileIds?: string[];
    maskFileId?: string;
    size?: string;
    aspectRatio?: string;
    outputFormat?: "jpeg" | "png";
    fluxModel?: "flux-kontext-pro" | "flux-kontext-max";
    resolution?: string;
    quality?: string;
    strength?: number;
    negativePrompt?: string;
    seed?: number;
    numImages?: number;
    acceleration?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskType = body.taskType ?? "text_to_image";
  const modelId = body.modelId ?? "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];
  const maskFileId = typeof body.maskFileId === "string" ? body.maskFileId : null;

  const tasksConfig = await getImageTasksConfig();
  const taskConfig = tasksConfig.find((t) => t.id === taskType && t.enabled);
  if (!taskConfig) {
    return NextResponse.json({ error: "Недопустимый тип задачи" }, { status: 400 });
  }

  const modelsConfig = await getImageModelsConfig();
  const modelConfig = modelsConfig.find((m) => m.id === modelId && m.enabled && m.taskIds.includes(taskType));
  if (!modelConfig) {
    return NextResponse.json({ error: "Недопустимая модель для этой задачи" }, { status: 400 });
  }

  const baseUrl = getPublicBaseUrl();
  const callBackUrl = `${baseUrl}/api/v1/webhooks/kie-image`;

  const uid: string = userId;
  async function getFileUrl(fileId: string): Promise<string> {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId: uid, deletedAt: null },
      select: { s3Key: true },
    });
    if (!file) throw new Error("File not found");
    return getPresignedDownloadUrl(file.s3Key, 3600);
  }

  /** При 429 ставим задачу в очередь и возвращаем taskId со статусом queued. */
  function enqueueAndReturn(
    kind: "4o" | "flux" | "market",
    queuePayload: { taskType: string; modelId: string; prompt?: string; fileIds?: string[]; maskFileId?: string | null; size?: string; aspectRatio?: string; outputFormat?: string; fluxModel?: string; resolution?: string; quality?: string; strength?: number; negativePrompt?: string; seed?: number; numImages?: number; acceleration?: string }
  ) {
    return (async () => {
      const variant = modelId === "kie-flux-kontext" ? (body.fluxModel ?? null) : null;
      const task = await prisma.imageGenerationTask.create({
        data: {
          userId: uid,
          kieTaskId: null,
          modelId,
          variant,
          taskType,
          status: "queued",
        },
      });
      await prisma.imageGenerationQueue.create({
        data: {
          taskId: task.id,
          kind,
          payload: queuePayload as unknown as object,
          status: "pending",
        },
      });
      return NextResponse.json({
        taskId: task.id,
        status: "queued",
        message: KIE_RATE_LIMIT_MESSAGE,
      });
    })();
  }

  let kieTaskId: string | null = null;

  if (modelId === "kie-4o-image") {
    const size4o: "1:1" | "3:2" | "2:3" =
      body.size === "3:2" || body.size === "2:3" ? body.size : "1:1";
    let filesUrl: string[] | undefined;
    if (fileIds.length > 0) {
      filesUrl = await Promise.all(fileIds.map(getFileUrl));
    }
    if ((taskType === "edit_image" || taskType === "variations") && (!filesUrl || filesUrl.length === 0)) {
      return NextResponse.json({ error: "Для этой задачи нужно загрузить изображение" }, { status: 400 });
    }
    if (taskType === "text_to_image" && !prompt && !filesUrl?.length) {
      return NextResponse.json({ error: "Укажите промпт или загрузите изображение" }, { status: 400 });
    }
    let maskUrl: string | undefined;
    if (maskFileId) {
      maskUrl = await getFileUrl(maskFileId);
    }
    const result = await create4oImageTask(apiKey, {
      prompt: prompt || undefined,
      filesUrl,
      size: size4o,
      maskUrl,
      callBackUrl,
    });
    if ("error" in result) {
      if (result.rateLimit) {
        return enqueueAndReturn("4o", { taskType, modelId, prompt, fileIds, maskFileId, size: body.size, aspectRatio: body.aspectRatio, outputFormat: body.outputFormat, fluxModel: body.fluxModel, resolution: body.resolution, quality: body.quality, strength: body.strength, negativePrompt: body.negativePrompt, seed: body.seed, numImages: body.numImages, acceleration: body.acceleration });
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else if (modelId === "kie-flux-kontext") {
    if (!prompt) {
      return NextResponse.json({ error: "Промпт обязателен" }, { status: 400 });
    }
    let inputImage: string | undefined;
    if (fileIds.length > 0) {
      inputImage = await getFileUrl(fileIds[0]);
    }
    const result = await createFluxImageTask(apiKey, {
      prompt,
      inputImage,
      aspectRatio: (body.aspectRatio as "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16") ?? "16:9",
      outputFormat: body.outputFormat ?? "jpeg",
      model: body.fluxModel ?? "flux-kontext-pro",
      callBackUrl,
      enableTranslation: true,
    });
    if ("error" in result) {
      if (result.rateLimit) {
        return enqueueAndReturn("flux", { taskType, modelId, prompt, fileIds, maskFileId, size: body.size, aspectRatio: body.aspectRatio, outputFormat: body.outputFormat, fluxModel: body.fluxModel, resolution: body.resolution, quality: body.quality, strength: body.strength, negativePrompt: body.negativePrompt, seed: body.seed, numImages: body.numImages, acceleration: body.acceleration });
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else if (isMarketModel(modelId)) {
    const kieModel = getKieModelForMarket(modelId);
    if (!kieModel) {
      return NextResponse.json({ error: "Неизвестная модель" }, { status: 400 });
    }
    let fileUrls: string[] = [];
    if (fileIds.length > 0) {
      fileUrls = await Promise.all(fileIds.map(getFileUrl));
    }
    const inputOrError = buildMarketInput({
      modelId,
      taskType,
      prompt,
      fileUrls,
      aspectRatio: body.aspectRatio ?? "1:1",
      resolution: body.resolution ?? "1K",
      outputFormat: body.outputFormat ?? "png",
      size: body.size ?? "1:1",
      quality: body.quality ?? "medium",
      strength: body.strength,
      negativePrompt: body.negativePrompt,
      seed: body.seed,
      numImages: body.numImages,
      acceleration: body.acceleration,
    });
    if ("error" in inputOrError) {
      return NextResponse.json({ error: inputOrError.error }, { status: 400 });
    }
    const result = await createMarketTask(apiKey, {
      model: kieModel,
      input: inputOrError,
      callBackUrl,
    });
    if ("error" in result) {
      if (result.rateLimit) {
        return enqueueAndReturn("market", { taskType, modelId, prompt, fileIds, maskFileId, size: body.size, aspectRatio: body.aspectRatio, outputFormat: body.outputFormat, fluxModel: body.fluxModel, resolution: body.resolution, quality: body.quality, strength: body.strength, negativePrompt: body.negativePrompt, seed: body.seed, numImages: body.numImages, acceleration: body.acceleration });
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else {
    return NextResponse.json({ error: "Неизвестная модель" }, { status: 400 });
  }

  const variant =
    modelId === "kie-flux-kontext" ? (body.fluxModel ?? null) : null;

  const task = await prisma.imageGenerationTask.create({
    data: {
      userId,
      kieTaskId,
      modelId,
      variant,
      taskType,
      status: "processing",
    },
  });

  return NextResponse.json({
    taskId: task.id,
    kieTaskId,
    status: "processing",
  });
}
