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

/**
 * Скачать изображение по URL, загрузить в S3 и создать запись File в хранилище пользователя.
 * Используется для автосохранения результата генерации на диск пользователя.
 */
export async function saveGeneratedImageToUserStorage(params: {
  userId: string;
  imageUrl: string;
  fileName?: string;
  folderId?: string | null;
}): Promise<PrismaFile> {
  const { userId, imageUrl, folderId = null } = params;

  const res = await fetch(imageUrl, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить изображение: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  const size = buffer.length;

  if (size === 0) throw new Error("Пустой файл изображения");
  const maxImageBytes = await getMaxFileSizeBytesForCategory("image");
  if (BigInt(size) > maxImageBytes) throw new Error("Файл изображения слишком большой");

  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const baseName = params.fileName?.replace(/\.[^/.]+$/, "") || "generated";
  const safeName = `${baseName}.${ext}`;
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

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
