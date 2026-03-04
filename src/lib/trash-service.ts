import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";
import { prisma } from "./prisma";
import { recordHistoryEvent } from "./history-service";

function generateBatchId(): string {
  return `trash_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Helpers to collect nested IDs (only non-deleted items)
// ---------------------------------------------------------------------------

async function collectFileIdsRecursive(folderId: string): Promise<string[]> {
  const files = await prisma.file.findMany({
    where: { folderId, deletedAt: null },
    select: { id: true },
  });
  const children = await prisma.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
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
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  let ids = [folderId];
  for (const child of children) {
    ids = ids.concat(await collectFolderIdsRecursive(child.id));
  }
  return ids;
}

async function collectAllFileIdsInFolder(folderId: string): Promise<string[]> {
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
    ids = ids.concat(await collectAllFileIdsInFolder(child.id));
  }
  return ids;
}

async function collectAllFolderIdsRecursive(folderId: string): Promise<string[]> {
  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  let ids = [folderId];
  for (const child of children) {
    ids = ids.concat(await collectAllFolderIdsRecursive(child.id));
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Check if user has trash feature
// ---------------------------------------------------------------------------

export async function getTrashRetentionDays(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { plan: true },
  });
  if (!user?.plan) return 0;
  return user.plan.trashRetentionDays ?? 0;
}

// ---------------------------------------------------------------------------
// Soft delete (move to trash)
// ---------------------------------------------------------------------------

export async function softDeleteFile(id: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!file) throw new Error("Файл не найден");

  const batchId = generateBatchId();
  await prisma.file.update({
    where: { id },
    data: { deletedAt: new Date(), trashBatchId: batchId },
  });

  let folderName: string | null = null;
  if (file.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: file.folderId, userId },
      select: { name: true },
    });
    folderName = folder?.name ?? null;
  }

  try {
    await recordHistoryEvent({
      userId,
      action: "trash",
      summary: `Вы переместили в корзину файл "${file.name}"`,
      payload: {
        file: { id: file.id, name: file.name, size: Number(file.size) },
        folderId: file.folderId,
        folderName,
      },
    });
  } catch {
    // history must not break core operations
  }
}

export async function softDeleteFolderRecursive(id: string, userId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!folder) throw new Error("Папка не найдена");

  const batchId = generateBatchId();
  const now = new Date();

  const fileIds = await collectFileIdsRecursive(id);
  const folderIds = await collectFolderIdsRecursive(id);

  await prisma.file.updateMany({
    where: { id: { in: fileIds } },
    data: { deletedAt: now, trashBatchId: batchId },
  });
  await prisma.folder.updateMany({
    where: { id: { in: folderIds } },
    data: { deletedAt: now, trashBatchId: batchId },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "trash",
      summary: `Вы переместили в корзину папку "${folder.name}"`,
      payload: {
        folder: { id: folder.id, name: folder.name },
        deletedFiles: fileIds.length,
        deletedFolders: folderIds.length,
      },
    });
  } catch {
    // history must not break core operations
  }
}

// ---------------------------------------------------------------------------
// Get trash items (top-level only)
// ---------------------------------------------------------------------------

export async function getTrashItems(userId: string) {
  const [files, folders] = await Promise.all([
    prisma.file.findMany({
      where: {
        userId,
        deletedAt: { not: null },
        OR: [
          { folderId: null },
          { folder: { deletedAt: null } },
        ],
      },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        folderId: true,
        mediaMetadata: true,
        deletedAt: true,
        trashBatchId: true,
        createdAt: true,
      },
    }),
    prisma.folder.findMany({
      where: {
        userId,
        deletedAt: { not: null },
        OR: [
          { parentId: null },
          { parent: { deletedAt: null } },
        ],
      },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        deletedAt: true,
        trashBatchId: true,
        createdAt: true,
      },
    }),
  ]);

  return { files, folders };
}

// ---------------------------------------------------------------------------
// Get trash size
// ---------------------------------------------------------------------------

export async function getTrashSize(userId: string): Promise<bigint> {
  const result = await prisma.file.aggregate({
    where: { userId, deletedAt: { not: null } },
    _sum: { size: true },
  });
  return result._sum.size ?? BigInt(0);
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export async function restoreFile(id: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });
  if (!file) throw new Error("Файл не найден в корзине");

  let targetFolderId = file.folderId;
  if (targetFolderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: targetFolderId, userId, deletedAt: null },
    });
    if (!folder) {
      targetFolderId = null;
    }
  }

  await prisma.file.update({
    where: { id },
    data: { deletedAt: null, trashBatchId: null, folderId: targetFolderId },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "restore",
      summary: `Вы восстановили файл "${file.name}" из корзины`,
      payload: {
        file: { id: file.id, name: file.name, size: Number(file.size) },
        restoredTo: targetFolderId,
      },
    });
  } catch {
    // history must not break core operations
  }
}

export async function restoreFolderRecursive(id: string, userId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });
  if (!folder) throw new Error("Папка не найдена в корзине");

  let targetParentId = folder.parentId;
  if (targetParentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: targetParentId, userId, deletedAt: null },
    });
    if (!parent) {
      targetParentId = null;
    }
  }

  const batchId = folder.trashBatchId;

  if (batchId) {
    await prisma.file.updateMany({
      where: { userId, trashBatchId: batchId },
      data: { deletedAt: null, trashBatchId: null },
    });
    await prisma.folder.updateMany({
      where: { userId, trashBatchId: batchId },
      data: { deletedAt: null, trashBatchId: null },
    });
  } else {
    await prisma.folder.update({
      where: { id },
      data: { deletedAt: null, trashBatchId: null },
    });
  }

  if (targetParentId !== folder.parentId) {
    await prisma.folder.update({
      where: { id },
      data: { parentId: targetParentId },
    });
  }

  try {
    await recordHistoryEvent({
      userId,
      action: "restore",
      summary: `Вы восстановили папку "${folder.name}" из корзины`,
      payload: {
        folder: { id: folder.id, name: folder.name },
        restoredTo: targetParentId,
      },
    });
  } catch {
    // history must not break core operations
  }
}

// ---------------------------------------------------------------------------
// Permanent delete from trash
// ---------------------------------------------------------------------------

export async function permanentDeleteFile(id: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });
  if (!file) throw new Error("Файл не найден в корзине");

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

export async function permanentDeleteFolderFromTrash(id: string, userId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });
  if (!folder) throw new Error("Папка не найдена в корзине");

  const fileIds = await collectAllFileIdsInFolder(id);
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

  const folderIds = await collectAllFolderIdsRecursive(id);
  await prisma.folder.deleteMany({
    where: { id: { in: folderIds } },
  });

  if (totalFreed > BigInt(0)) {
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { decrement: totalFreed } },
    });
  }
}

// ---------------------------------------------------------------------------
// Empty entire trash
// ---------------------------------------------------------------------------

export async function emptyTrash(userId: string) {
  const trashedFiles = await prisma.file.findMany({
    where: { userId, deletedAt: { not: null } },
    select: { id: true, s3Key: true, size: true },
  });

  let totalFreed = BigInt(0);

  if (trashedFiles.length > 0) {
    const config = await getS3Config();
    const client = createS3Client({ ...config, forcePathStyle: true });

    for (const file of trashedFiles) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
        );
      } catch {
        // continue even if individual S3 delete fails
      }
      totalFreed += file.size;
    }

    await prisma.file.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });
  }

  await prisma.folder.deleteMany({
    where: { userId, deletedAt: { not: null } },
  });

  if (totalFreed > BigInt(0)) {
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { decrement: totalFreed } },
    });
  }

  try {
    await recordHistoryEvent({
      userId,
      action: "trash_empty",
      summary: "Вы очистили корзину",
      payload: { freedBytes: Number(totalFreed), deletedFiles: trashedFiles.length },
    });
  } catch {
    // history must not break core operations
  }

  return { deletedFiles: trashedFiles.length, freedBytes: totalFreed };
}

// ---------------------------------------------------------------------------
// Purge expired trash items (for cron / lazy cleanup)
// ---------------------------------------------------------------------------

export async function purgeExpiredTrashItems() {
  const plans = await prisma.plan.findMany({
    where: { trashRetentionDays: { gt: 0 } },
    select: { id: true, trashRetentionDays: true },
  });

  const planRetention = new Map<string, number>();
  for (const p of plans) {
    planRetention.set(p.id, p.trashRetentionDays);
  }

  const usersWithTrash = await prisma.user.findMany({
    where: {
      files: { some: { deletedAt: { not: null } } },
    },
    select: { id: true, planId: true },
  });

  let totalPurged = 0;

  for (const user of usersWithTrash) {
    const retentionDays = user.planId ? (planRetention.get(user.planId) ?? 0) : 0;
    if (retentionDays <= 0) {
      const result = await emptyTrash(user.id);
      totalPurged += result.deletedFiles;
      continue;
    }

    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const expiredFiles = await prisma.file.findMany({
      where: {
        userId: user.id,
        deletedAt: { not: null, lt: cutoff },
      },
      select: { id: true, s3Key: true, size: true },
    });

    if (expiredFiles.length === 0) continue;

    const config = await getS3Config();
    const client = createS3Client({ ...config, forcePathStyle: true });
    let freed = BigInt(0);

    for (const file of expiredFiles) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
        );
      } catch {
        // continue
      }
      freed += file.size;
    }

    await prisma.file.deleteMany({
      where: { id: { in: expiredFiles.map((f) => f.id) } },
    });

    const expiredFolders = await prisma.folder.findMany({
      where: {
        userId: user.id,
        deletedAt: { not: null, lt: cutoff },
        files: { none: {} },
        children: { none: {} },
      },
      select: { id: true },
    });
    if (expiredFolders.length > 0) {
      await prisma.folder.deleteMany({
        where: { id: { in: expiredFolders.map((f) => f.id) } },
      });
    }

    if (freed > BigInt(0)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { storageUsed: { decrement: freed } },
      });
    }

    totalPurged += expiredFiles.length;
  }

  return { totalPurged };
}
