import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { hasFeature, getUserPlan } from "@/lib/plan-service";
import {
  getVideoGenerationEnabled,
  getVideoTasksConfig,
  getVideoModelsConfig,
} from "@/lib/generation/config";
import { getVideoGenerationCreditsUsedThisMonth } from "@/lib/generation/billing";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import { createMarketTask, KIE_RATE_LIMIT_MESSAGE } from "@/lib/generation/kie-image-client";
import {
  getKieVideoMarketModel,
  buildKling30VideoInput,
  buildKling30MotionInput,
  OUR_VIDEO_MODEL_IDS,
} from "@/lib/generation/kie-video-models";
import { buildKling30VideoPricingVariant, buildKling30MotionPricingVariant } from "@/lib/generation/kie-video-variant";
import { getMotionReferenceDurationSec } from "@/lib/generation/video-billable-duration";
import { getPublicBaseUrl } from "@/lib/app-url";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

type VideoQueuePayload = Record<string, unknown>;

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await hasFeature(userId, "video_generation");
  if (!canGenerate) {
    return NextResponse.json({ error: "Тариф не включает генерацию видео" }, { status: 403 });
  }

  const videoOn = await getVideoGenerationEnabled();
  if (!videoOn) {
    return NextResponse.json({ error: "Генерация видео временно отключена" }, { status: 503 });
  }

  const apiKey = await getKieApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Сервис генерации не настроен. Обратитесь к администратору." }, { status: 503 });
  }

  const [plan, usedCreditsThisMonth, user] = await Promise.all([
    getUserPlan(userId),
    getVideoGenerationCreditsUsedThisMonth(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { llmWalletBalanceCents: true } }),
  ]);
  const quota = plan?.videoGenerationCreditsQuota;
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
    duration?: number;
    mode?: string;
    sound?: boolean;
    aspectRatio?: string;
    startFrameFileId?: string | null;
    endFrameFileId?: string | null;
    multiShots?: boolean;
    motionImageFileId?: string | null;
    motionVideoFileId?: string | null;
    characterOrientation?: string;
    motionMode?: string;
    backgroundSource?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskType = body.taskType ?? "";
  const modelId = body.modelId ?? "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  const tasksConfig = await getVideoTasksConfig();
  const taskConfig = tasksConfig.find((t) => t.id === taskType && t.enabled);
  if (!taskConfig) {
    return NextResponse.json({ error: "Недопустимый тип задачи" }, { status: 400 });
  }

  const modelsConfig = await getVideoModelsConfig();
  const modelConfig = modelsConfig.find((m) => m.id === modelId && m.enabled && m.taskIds.includes(taskType));
  if (!modelConfig || !OUR_VIDEO_MODEL_IDS.has(modelId)) {
    return NextResponse.json({ error: "Недопустимая модель для этой задачи" }, { status: 400 });
  }

  const kieModel = getKieVideoMarketModel(modelId);
  if (!kieModel) {
    return NextResponse.json({ error: "Неизвестная видео-модель" }, { status: 400 });
  }

  const baseUrl = getPublicBaseUrl();
  const callBackUrl = `${baseUrl}/api/v1/webhooks/kie-video`;

  const uid: string = userId;
  async function getFileUrl(fileId: string): Promise<string> {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId: uid, deletedAt: null },
      select: { s3Key: true, mimeType: true },
    });
    if (!file) throw new Error("File not found");
    return getPresignedDownloadUrl(file.s3Key, 3600);
  }

  function enqueueAndReturn(kind: string, queuePayload: VideoQueuePayload) {
    return (async () => {
      const videoDurationSec = Math.min(15, Math.max(3, Math.round(Number(body.duration) || 5)));
      const variant =
        modelId === "kie-kling-30-video"
          ? buildKling30VideoPricingVariant({
              mode: (body.mode === "pro" ? "pro" : "std") as "std" | "pro",
              durationSec: videoDurationSec,
              sound: Boolean(body.sound),
            })
          : buildKling30MotionPricingVariant({
              mode: body.motionMode === "1080p" ? "1080p" : "720p",
              characterOrientation: body.characterOrientation === "image" ? "image" : "video",
            });

      let billableDurationSec: number | null =
        modelId === "kie-kling-30-video"
          ? videoDurationSec
          : typeof body.motionVideoFileId === "string"
            ? await getMotionReferenceDurationSec(body.motionVideoFileId, uid)
            : null;

      const task = await prisma.videoGenerationTask.create({
        data: {
          userId: uid,
          kieTaskId: null,
          modelId,
          variant,
          billableDurationSec,
          taskType,
          status: "queued",
        },
      });
      await prisma.videoGenerationQueue.create({
        data: {
          taskId: task.id,
          kind,
          payload: queuePayload as object,
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
  let variant: string | null = null;
  let input: Record<string, unknown>;
  let billableDurationSec: number | null = null;

  if (modelId === "kie-kling-30-video") {
    if (!prompt) {
      return NextResponse.json({ error: "Введите промпт" }, { status: 400 });
    }
    const durationSec = Math.min(15, Math.max(3, Math.round(Number(body.duration) || 5)));
    billableDurationSec = durationSec;
    const mode = body.mode === "std" ? "std" : "pro";
    const sound = Boolean(body.sound);
    const aspectRatio = (["16:9", "9:16", "1:1"].includes(body.aspectRatio ?? "")
      ? body.aspectRatio
      : "16:9") as "16:9" | "9:16" | "1:1";
    const multiShots = Boolean(body.multiShots);
    const imageUrls: string[] = [];
    if (body.startFrameFileId) {
      imageUrls.push(await getFileUrl(body.startFrameFileId));
    }
    if (body.endFrameFileId) {
      imageUrls.push(await getFileUrl(body.endFrameFileId));
    }
    if (imageUrls.length === 1 && body.endFrameFileId && !body.startFrameFileId) {
      return NextResponse.json({ error: "Сначала задайте стартовый кадр или только один кадр как старт" }, { status: 400 });
    }

    variant = buildKling30VideoPricingVariant({ mode, durationSec, sound });
    input = buildKling30VideoInput({
      prompt,
      durationSec,
      mode,
      sound,
      aspectRatio,
      multiShots,
      imageUrls,
      multiPrompt: [],
    });

    const queuePayload: VideoQueuePayload = {
      taskType,
      modelId,
      prompt,
      duration: durationSec,
      mode,
      sound,
      aspectRatio,
      startFrameFileId: body.startFrameFileId ?? null,
      endFrameFileId: body.endFrameFileId ?? null,
      multiShots,
    };

    const result = await createMarketTask(apiKey, { model: kieModel, input, callBackUrl });
    if ("error" in result) {
      if (result.rateLimit) {
        return enqueueAndReturn("kling30_video", queuePayload);
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else if (modelId === "kie-kling-30-motion") {
    const imgId = body.motionImageFileId;
    const vidId = body.motionVideoFileId;
    if (!imgId || !vidId) {
      return NextResponse.json({ error: "Нужны референс-изображение и референс-видео" }, { status: 400 });
    }
    billableDurationSec = await getMotionReferenceDurationSec(vidId, userId);
    const motionMode = body.motionMode === "1080p" ? "1080p" : "720p";
    const characterOrientation = body.characterOrientation === "image" ? "image" : "video";
    const backgroundSource =
      body.backgroundSource === "input_image" ? "input_image" : body.backgroundSource === "input_video" ? "input_video" : undefined;

    const inputUrls = [await getFileUrl(imgId)];
    const videoUrls = [await getFileUrl(vidId)];

    variant = buildKling30MotionPricingVariant({ mode: motionMode, characterOrientation });
    input = buildKling30MotionInput({
      prompt: prompt || undefined,
      inputUrls,
      videoUrls,
      mode: motionMode,
      characterOrientation,
      backgroundSource,
    });

    const queuePayload: VideoQueuePayload = {
      taskType,
      modelId,
      prompt,
      motionImageFileId: imgId,
      motionVideoFileId: vidId,
      motionMode,
      characterOrientation,
      backgroundSource,
    };

    const result = await createMarketTask(apiKey, { model: kieModel, input, callBackUrl });
    if ("error" in result) {
      if (result.rateLimit) {
        return enqueueAndReturn("kling30_motion", queuePayload);
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else {
    return NextResponse.json({ error: "Неизвестная модель" }, { status: 400 });
  }

  const task = await prisma.videoGenerationTask.create({
    data: {
      userId,
      kieTaskId,
      modelId,
      variant,
      billableDurationSec,
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
