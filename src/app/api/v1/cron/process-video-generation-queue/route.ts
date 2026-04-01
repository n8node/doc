import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKieApiKey } from "@/lib/generation/kie-api-key";
import { getPublicBaseUrl } from "@/lib/app-url";
import { getPresignedDownloadUrl } from "@/lib/s3-download";
import { createMarketTask } from "@/lib/generation/kie-image-client";
import {
  getKieVideoMarketModel,
  buildKling30VideoInput,
  buildKling30MotionInput,
} from "@/lib/generation/kie-video-models";

const KIE_LIMIT_PER_RUN = 20;

type QueuePayload = Record<string, unknown>;

/**
 * POST /api/v1/cron/process-video-generation-queue
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
  const callBackUrl = `${baseUrl}/api/v1/webhooks/kie-video`;

  const queueRows = await prisma.videoGenerationQueue.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: KIE_LIMIT_PER_RUN,
  });

  let sent = 0;
  let rateLimited = false;

  for (const row of queueRows) {
    if (rateLimited) break;

    const task = await prisma.videoGenerationTask.findUnique({
      where: { id: row.taskId },
    });
    if (!task || task.status !== "queued") {
      await prisma.videoGenerationQueue.update({
        where: { id: row.id },
        data: { status: "sent" },
      });
      continue;
    }

    const payload = row.payload as QueuePayload;
    const userId = task.userId;
    const modelId = String(payload.modelId ?? task.modelId);
    const kieModel = getKieVideoMarketModel(modelId);
    if (!kieModel) {
      continue;
    }

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
      if (row.kind === "kling30_video") {
        const prompt = String(payload.prompt ?? "").trim();
        const durationSec = Math.min(15, Math.max(3, Math.round(Number(payload.duration) || 5)));
        const mode = payload.mode === "std" ? "std" : "pro";
        const sound = Boolean(payload.sound);
        const aspectRatio = (["16:9", "9:16", "1:1"].includes(String(payload.aspectRatio))
          ? payload.aspectRatio
          : "16:9") as "16:9" | "9:16" | "1:1";
        const multiShots = Boolean(payload.multiShots);
        const imageUrls: string[] = [];
        if (typeof payload.startFrameFileId === "string") {
          imageUrls.push(await getFileUrl(payload.startFrameFileId));
        }
        if (typeof payload.endFrameFileId === "string") {
          imageUrls.push(await getFileUrl(payload.endFrameFileId));
        }
        const input = buildKling30VideoInput({
          prompt,
          durationSec,
          mode,
          sound,
          aspectRatio,
          multiShots,
          imageUrls,
          multiPrompt: [],
        });
        result = await createMarketTask(apiKey, { model: kieModel, input, callBackUrl });
      } else if (row.kind === "kling30_motion") {
        const imgId = payload.motionImageFileId;
        const vidId = payload.motionVideoFileId;
        if (typeof imgId !== "string" || typeof vidId !== "string") {
          result = { error: "missing files" };
        } else {
          const motionMode = payload.motionMode === "1080p" ? "1080p" : "720p";
          const characterOrientation = payload.characterOrientation === "image" ? "image" : "video";
          const backgroundSource =
            payload.backgroundSource === "input_image"
              ? "input_image"
              : payload.backgroundSource === "input_video"
                ? "input_video"
                : undefined;
          const input = buildKling30MotionInput({
            prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
            inputUrls: [await getFileUrl(imgId)],
            videoUrls: [await getFileUrl(vidId)],
            mode: motionMode,
            characterOrientation,
            backgroundSource,
          });
          result = await createMarketTask(apiKey, { model: kieModel, input, callBackUrl });
        }
      } else {
        continue;
      }
    } catch (e) {
      console.warn("[process-video-generation-queue]", row.id, e);
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
      prisma.videoGenerationTask.update({
        where: { id: task.id },
        data: { kieTaskId: result.taskId, status: "processing" },
      }),
      prisma.videoGenerationQueue.update({
        where: { id: row.id },
        data: { status: "sent" },
      }),
    ]);
    sent++;
  }

  return NextResponse.json({ ok: true, processed: queueRows.length, sent });
}
