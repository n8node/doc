import { prisma } from "./prisma";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { recordHistoryEvent } from "./history-service";

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
