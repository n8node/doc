import { PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { prisma } from "./prisma";
import { recordHistoryEvent } from "./history-service";

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
  clientBatchId?: string | null;
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
  const { userId, name, mimeType, size, s3Key, folderId, mediaDurationSeconds, clientBatchId } = input;

  if (size === 0) {
    throw new Error("Пустые документы загружать нельзя");
  }

  if (!Number.isFinite(size) || size < 0) {
    throw new Error("Некорректный размер файла");
  }

  let folderName: string | null = null;
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true, name: true },
    });
    if (!folder) throw new Error("Папка не найдена");
    folderName = folder.name;
  }

  const mediaMetadata =
    mediaDurationSeconds != null && mediaDurationSeconds > 0
      ? { durationSeconds: Math.round(mediaDurationSeconds) }
      : null;

  const createdFile = await prisma.$transaction(async (tx) => {
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

  try {
    await recordHistoryEvent({
      userId,
      action: "upload",
      summary: `Вы загрузили файл "${createdFile.name}"`,
      batchId: clientBatchId ?? null,
      payload: {
        file: {
          id: createdFile.id,
          name: createdFile.name,
          size: Number(createdFile.size),
        },
        folderId: createdFile.folderId,
        folderName,
      },
    });
  } catch {
    // history must not break core file operations
  }

  return createdFile;
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

  let folderName: string | null = null;
  if (file.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: file.folderId, userId },
      select: { name: true },
    });
    folderName = folder?.name ?? null;
  }

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

  try {
    await recordHistoryEvent({
      userId,
      action: "delete",
      summary: `Вы удалили файл "${file.name}"`,
      payload: {
        file: {
          id: file.id,
          name: file.name,
          size: Number(file.size),
        },
        folderId: file.folderId,
        folderName,
      },
    });
  } catch {
    // history must not break core file operations
  }
}

export async function moveFile(id: string, folderId: string | null, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId },
  });
  if (!file) throw new Error("Файл не найден");

  let fromFolderName: string | null = null;
  if (file.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: file.folderId, userId },
      select: { name: true },
    });
    fromFolderName = folder?.name ?? null;
  }

  let toFolderName: string | null = null;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true, name: true },
    });
    if (!folder) throw new Error("Папка не найдена");
    toFolderName = folder.name;
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

  const updated = await prisma.file.update({
    where: { id },
    data: { folderId, s3Key: newS3Key },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "move",
      summary:
        toFolderName != null
          ? `Вы переместили файл "${file.name}" в папку "${toFolderName}"`
          : `Вы переместили файл "${file.name}" в корневую папку`,
      payload: {
        file: {
          id: updated.id,
          name: updated.name,
          size: Number(updated.size),
        },
        fromFolderId: file.folderId,
        fromFolderName,
        toFolderId: updated.folderId,
        toFolderName,
      },
    });
  } catch {
    // history must not break core file operations
  }

  return updated;
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
