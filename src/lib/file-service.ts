import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { prisma } from "./prisma";

export interface UploadFileInput {
  userId: string;
  file: File;
  folderId?: string | null;
  mediaDurationSeconds?: number | null;
}

export async function uploadFile(input: UploadFileInput) {
  const { userId, file, folderId, mediaDurationSeconds } = input;
  const config = await getS3Config();

  const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const baseName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-\p{L}]/gu, "_")
    .slice(0, 100) || "file";
  const safeName = ext ? `${baseName}.${ext}` : baseName;
  const timestamp = Date.now();
  const s3Key = folderId
    ? `users/${userId}/${folderId}/${timestamp}-${safeName}`
    : `users/${userId}/${timestamp}-${safeName}`;

  const client = createS3Client({
    ...config,
    forcePathStyle: true,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        "x-user-id": userId,
        "x-original-name": Buffer.from(file.name, "utf-8").toString("base64url"),
      },
    })
  );

  const mediaMetadata =
    mediaDurationSeconds != null && mediaDurationSeconds > 0
      ? { durationSeconds: Math.round(mediaDurationSeconds) }
      : null;

  const dbFile = await prisma.file.create({
    data: {
      name: file.name,
      mimeType: contentType,
      size: BigInt(file.size),
      s3Key,
      folderId: folderId ?? null,
      userId,
      mediaMetadata,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { increment: BigInt(file.size) } },
  });

  return dbFile;
}
