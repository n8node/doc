import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { File as PrismaFile } from "@prisma/client";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";
import {
  buildS3Key,
  createFileRecordFromS3Object,
  type CreateFileRecordInput,
} from "@/lib/file-service";
import { getMaxFileSizeBytesForCategory } from "@/lib/storage-file-limits";

function extFromContentType(contentType: string): { ext: string; mimeType: string } {
  const ct = contentType.toLowerCase();
  if (ct.includes("webm")) return { ext: "webm", mimeType: "video/webm" };
  if (ct.includes("quicktime") || ct.includes("video/quicktime")) return { ext: "mov", mimeType: "video/quicktime" };
  if (ct.includes("mp4") || ct.includes("mpeg4")) return { ext: "mp4", mimeType: "video/mp4" };
  return { ext: "mp4", mimeType: "video/mp4" };
}

/**
 * Скачать видео по URL, загрузить в S3 и создать запись File.
 */
export async function saveGeneratedVideoToUserStorage(params: {
  userId: string;
  videoUrl: string;
  fileName?: string;
  folderId?: string | null;
}): Promise<PrismaFile> {
  const { userId, videoUrl, folderId = null } = params;

  const res = await fetch(videoUrl, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить видео: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await res.arrayBuffer());
  const size = buffer.length;

  if (size === 0) throw new Error("Пустой файл видео");
  const maxVideoBytes = await getMaxFileSizeBytesForCategory("video");
  if (BigInt(size) > maxVideoBytes) throw new Error("Файл видео слишком большой");

  const { ext, mimeType } = extFromContentType(contentType);
  const baseName = params.fileName?.replace(/\.[^/.]+$/, "") || "generated-video";
  const safeName = `${baseName}.${ext}`;

  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  const s3Key = buildS3Key({ userId, fileName: safeName, folderId });

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        "x-user-id": userId,
        "x-original-name": Buffer.from(safeName, "utf-8").toString("base64url"),
      },
    })
  );

  const input: CreateFileRecordInput = {
    userId,
    name: safeName,
    mimeType,
    size,
    s3Key,
    folderId,
  };

  return createFileRecordFromS3Object(input);
}
