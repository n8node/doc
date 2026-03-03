import { PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { prisma } from "./prisma";

export interface UploadFileInput {
  userId: string;
  file: File;
  folderId?: string | null;
  mediaDurationSeconds?: number | null;
}

export interface CreateFileRecordInput {
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  folderId?: string | null;
  mediaDurationSeconds?: number | null;
}

function buildSafeFileName(fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, "_")
    .slice(0, 100) || "file";
  return ext ? `${baseName}.${ext}` : baseName;
}

export function buildS3Key(input: {
  userId: string;
  fileName: string;
  folderId?: string | null;
  timestamp?: number;
}) {
  const { userId, fileName, folderId, timestamp = Date.now() } = input;
  const safeName = buildSafeFileName(fileName);
  return folderId
    ? `users/${userId}/${folderId}/${timestamp}-${safeName}`
    : `users/${userId}/${timestamp}-${safeName}`;
}

export async function createFileRecordFromS3Object(input: CreateFileRecordInput) {
  const { userId, name, mimeType, size, s3Key, folderId, mediaDurationSeconds } = input;

  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Некорректный размер файла");
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!folder) throw new Error("Папка не найдена");
  }

  const mediaMetadata =
    mediaDurationSeconds != null && mediaDurationSeconds > 0
      ? { durationSeconds: Math.round(mediaDurationSeconds) }
      : null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.file.findFirst({
      where: { userId, s3Key },
    });
    if (existing) return existing;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { storageQuota: true },
    });
    if (!user) throw new Error("User not found");

    const fileSize = BigInt(size);
    if (fileSize > user.storageQuota) {
      throw new Error("Превышен лимит хранилища");
    }

    const maxAllowedUsed = user.storageQuota - fileSize;
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        storageUsed: { lte: maxAllowedUsed },
      },
      data: {
        storageUsed: { increment: fileSize },
      },
    });
    if (updated.count === 0) {
      throw new Error("Превышен лимит хранилища");
    }

    return tx.file.create({
      data: {
        name,
        mimeType: mimeType || "application/octet-stream",
        size: fileSize,
        s3Key,
        folderId: folderId ?? null,
        userId,
        ...(mediaMetadata && { mediaMetadata }),
      },
    });
  });
}

export async function uploadFile(input: UploadFileInput) {
  const { userId, file, folderId, mediaDurationSeconds } = input;
  const config = await getS3Config();

  const s3Key = buildS3Key({
    userId,
    fileName: file.name,
    folderId,
  });

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

  return createFileRecordFromS3Object({
    userId,
    name: file.name,
    mimeType: contentType,
    size: file.size,
    s3Key,
    folderId: folderId ?? null,
    mediaDurationSeconds,
  });
}

export async function deleteFile(id: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId },
  });
  if (!file) throw new Error("Файл не найден");

  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
  );
  await prisma.file.delete({ where: { id } });
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { decrement: file.size } },
  });
}

export async function moveFile(id: string, folderId: string | null, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId },
  });
  if (!file) throw new Error("Файл не найден");

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error("Папка не найдена");
  }

  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });

  const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const baseName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, "_")
    .slice(0, 100) || "file";
  const safeName = ext ? `${baseName}.${ext}` : baseName;
  const timestamp = Date.now();
  const newS3Key = folderId
    ? `users/${userId}/${folderId}/${timestamp}-${safeName}`
    : `users/${userId}/${timestamp}-${safeName}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      CopySource: `${config.bucket}/${file.s3Key}`,
      Key: newS3Key,
    })
  );
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
  );

  return prisma.file.update({
    where: { id },
    data: { folderId, s3Key: newS3Key },
  });
}

export async function renameFile(id: string, name: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId },
  });
  if (!file) throw new Error("Файл не найден");
  return prisma.file.update({
    where: { id },
    data: { name },
  });
}
