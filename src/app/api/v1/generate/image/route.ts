import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan-service";
import { getImageGenerationEnabled, getImageTasksConfig, getImageModelsConfig } from "@/lib/generation/config";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import { create4oImageTask, createFluxImageTask } from "@/lib/generation/kie-image-client";
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

  let body: {
    taskType?: string;
    modelId?: string;
    prompt?: string;
    fileIds?: string[];
    maskFileId?: string;
    size?: "1:1" | "3:2" | "2:3";
    aspectRatio?: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
    outputFormat?: "jpeg" | "png";
    fluxModel?: "flux-kontext-pro" | "flux-kontext-max";
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

  async function getFileUrl(fileId: string): Promise<string> {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
      select: { s3Key: true },
    });
    if (!file) throw new Error("File not found");
    return getPresignedDownloadUrl(file.s3Key, 3600);
  }

  let kieTaskId: string;

  if (modelId === "kie-4o-image") {
    const size = body.size ?? "1:1";
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
      size,
      maskUrl,
      callBackUrl,
    });
    if ("error" in result) {
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
      aspectRatio: body.aspectRatio ?? "16:9",
      outputFormat: body.outputFormat ?? "jpeg",
      model: body.fluxModel ?? "flux-kontext-pro",
      callBackUrl,
      enableTranslation: true,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    kieTaskId = result.taskId;
  } else {
    return NextResponse.json({ error: "Неизвестная модель" }, { status: 400 });
  }

  const task = await prisma.imageGenerationTask.create({
    data: {
      userId,
      kieTaskId,
      modelId,
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
