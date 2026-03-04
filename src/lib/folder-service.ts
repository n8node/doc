import { prisma } from "./prisma";
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { recordHistoryEvent } from "./history-service";
import { buildDuplicateName, buildS3Key, encodeCopySource } from "./file-service";

export async function createFolder(
  name: string,
  parentId: string | null,
  userId: string
) {
  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, userId },
    });
    if (!parent) throw new Error("Родительская папка не найдена");
  }
  const created = await prisma.folder.create({
    data: { name, parentId, userId },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "folder_create",
      summary: `Вы создали папку "${created.name}"`,
      payload: {
        folder: { id: created.id, name: created.name },
        parentId: created.parentId,
      },
    });
  } catch {
    // history must not break core folder operations
  }

  return created;
}

async function collectFileIdsRecursive(folderId: string): Promise<string[]> {
  const files = await prisma.file.findMany({
    where: { folderId },
    select: { id: true },
  });
  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  let ids = files.map((f) => f.id);
  for (const child of children) {
    ids = ids.concat(await collectFileIdsRecursive(child.id));
  }
  return ids;
}

async function collectFolderIdsRecursive(folderId: string): Promise<string[]> {
  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  let ids = [folderId];
  for (const child of children) {
    ids = ids.concat(await collectFolderIdsRecursive(child.id));
  }
  return ids;
}

export async function deleteFolderRecursive(id: string, userId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id, userId },
  });
  if (!folder) throw new Error("Папка не найдена");

  const fileIds = await collectFileIdsRecursive(id);
  let totalFreed = BigInt(0);

  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });

  for (const fileId of fileIds) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (file) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
      );
      totalFreed += file.size;
      await prisma.file.delete({ where: { id: fileId } });
    }
  }

  const folderIds = await collectFolderIdsRecursive(id);
  await prisma.folder.deleteMany({
    where: { id: { in: folderIds } },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { decrement: totalFreed } },
  });

  const result = { deletedFiles: fileIds.length, deletedFolders: folderIds.length };

  try {
    await recordHistoryEvent({
      userId,
      action: "folder_delete",
      summary: `Вы удалили папку "${folder.name}"`,
      payload: {
        folder: { id: folder.id, name: folder.name },
        deletedFiles: result.deletedFiles,
        deletedFolders: result.deletedFolders,
        freedBytes: Number(totalFreed),
      },
    });
  } catch {
    // history must not break core folder operations
  }

  return result;
}

async function isDescendantOf(
  folderId: string,
  ancestorId: string
): Promise<boolean> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { parentId: true },
  });
  if (!folder || !folder.parentId) return false;
  if (folder.parentId === ancestorId) return true;
  return isDescendantOf(folder.parentId, ancestorId);
}

export async function copyFolder(
  id: string,
  newParentId: string | null,
  userId: string
) {
  const sourceFolder = await prisma.folder.findFirst({
    where: { id, userId },
  });
  if (!sourceFolder) throw new Error("Папка не найдена");
  if (id === newParentId) throw new Error("Нельзя скопировать папку в саму себя");

  let newParentName: string | null = null;
  if (newParentId) {
    if (await isDescendantOf(newParentId, id)) {
      throw new Error("Нельзя скопировать папку в свою дочернюю папку");
    }
    const parent = await prisma.folder.findFirst({
      where: { id: newParentId, userId },
      select: { id: true, name: true },
    });
    if (!parent) throw new Error("Целевая папка не найдена");
    newParentName = parent.name;
  }

  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });

  const copiedCounters = {
    folders: 0,
    files: 0,
    bytes: BigInt(0),
  };

  const copyFolderRecursive = async (
    sourceFolderId: string,
    targetParentId: string | null,
    isRootLevel: boolean
  ): Promise<{ id: string; name: string }> => {
    const source = await prisma.folder.findFirst({
      where: { id: sourceFolderId, userId },
      select: { id: true, name: true },
    });
    if (!source) throw new Error("Папка не найдена");

    const createdFolder = await prisma.folder.create({
      data: {
        name: buildDuplicateName(source.name, { preserveExtension: false }),
        parentId: targetParentId,
        userId,
      },
      select: { id: true, name: true },
    });
    if (!isRootLevel) {
      copiedCounters.folders += 1;
    }

    const sourceFiles = await prisma.file.findMany({
      where: { folderId: source.id, userId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        s3Key: true,
        mediaMetadata: true,
      },
    });

    for (const file of sourceFiles) {
      const duplicatedFileName = buildDuplicateName(file.name);
      const newS3Key = buildS3Key({
        userId,
        fileName: duplicatedFileName,
        folderId: createdFolder.id,
      });

      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          CopySource: encodeCopySource(config.bucket, file.s3Key),
          Key: newS3Key,
        })
      );

      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { storageQuota: true },
          });
          if (!user) throw new Error("User not found");

          const fileSize = file.size;
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

          await tx.file.create({
            data: {
              name: duplicatedFileName,
              mimeType: file.mimeType,
              size: fileSize,
              s3Key: newS3Key,
              folderId: createdFolder.id,
              userId,
              ...(file.mediaMetadata ? { mediaMetadata: file.mediaMetadata } : {}),
            },
          });
        });
      } catch (error) {
        try {
          await client.send(
            new DeleteObjectCommand({
              Bucket: config.bucket,
              Key: newS3Key,
            })
          );
        } catch {
          // ignore cleanup errors
        }
        throw error;
      }

      copiedCounters.files += 1;
      copiedCounters.bytes += file.size;
    }

    const sourceChildren = await prisma.folder.findMany({
      where: { parentId: source.id, userId },
      select: { id: true },
    });

    for (const child of sourceChildren) {
      await copyFolderRecursive(child.id, createdFolder.id, false);
    }

    return createdFolder;
  };

  const copiedRoot = await copyFolderRecursive(id, newParentId, true);

  try {
    await recordHistoryEvent({
      userId,
      action: "folder_copy",
      summary:
        newParentName != null
          ? `Вы скопировали папку "${sourceFolder.name}" в "${newParentName}"`
          : `Вы скопировали папку "${sourceFolder.name}" в корень`,
      payload: {
        folder: { id: copiedRoot.id, name: copiedRoot.name },
        sourceFolder: { id: sourceFolder.id, name: sourceFolder.name },
        toParentId: newParentId,
        toParentName: newParentName,
        copiedFiles: copiedCounters.files,
        copiedFolders: copiedCounters.folders,
        copiedBytes: Number(copiedCounters.bytes),
      },
    });
  } catch {
    // history must not break core folder operations
  }

  return copiedRoot;
}

export async function moveFolder(
  id: string,
  newParentId: string | null,
  userId: string
) {
  const folder = await prisma.folder.findFirst({
    where: { id, userId },
  });
  if (!folder) throw new Error("Папка не найдена");
  if (id === newParentId) throw new Error("Нельзя переместить папку в саму себя");
  let newParentName: string | null = null;
  if (newParentId) {
    if (await isDescendantOf(newParentId, id))
      throw new Error("Нельзя переместить папку в свою дочернюю папку");
    const parent = await prisma.folder.findFirst({
      where: { id: newParentId, userId },
      select: { id: true, name: true },
    });
    if (!parent) throw new Error("Целевая папка не найдена");
    newParentName = parent.name;
  }
  const updated = await prisma.folder.update({
    where: { id },
    data: { parentId: newParentId },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "folder_move",
      summary:
        newParentName != null
          ? `Вы переместили папку "${updated.name}" в "${newParentName}"`
          : `Вы переместили папку "${updated.name}" в корень`,
      payload: {
        folder: { id: updated.id, name: updated.name },
        toParentId: updated.parentId,
        toParentName: newParentName,
      },
    });
  } catch {
    // history must not break core folder operations
  }

  return updated;
}

export async function renameFolder(id: string, name: string, userId: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Имя папки не может быть пустым");
  if (trimmed.length > 255) throw new Error("Имя папки слишком длинное");
  const folder = await prisma.folder.findFirst({
    where: { id, userId },
  });
  if (!folder) throw new Error("Папка не найдена");
  return prisma.folder.update({
    where: { id },
    data: { name: trimmed },
  });
}
