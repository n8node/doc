import { nanoid } from "nanoid";
import { prisma } from "./prisma";
import { recordHistoryEvent } from "./history-service";

export interface CreateShareLinkInput {
  targetType: "FILE" | "FOLDER";
  fileId?: string | null;
  folderId?: string | null;
  expiresAt?: Date | null;
  oneTime?: boolean;
  userId: string;
}

export async function createShareLink(input: CreateShareLinkInput) {
  const { targetType, fileId, folderId, expiresAt, oneTime, userId } = input;
  let fileName: string | null = null;
  let folderName: string | null = null;

  if (targetType === "FILE") {
    const file = await prisma.file.findFirst({
      where: { id: fileId!, userId, deletedAt: null },
    });
    if (!file) throw new Error("Файл не найден");
    fileName = file.name;
  } else {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId!, userId, deletedAt: null },
    });
    if (!folder) throw new Error("Папка не найдена");
    folderName = folder.name;
  }

  const token = nanoid(12);

  const created = await prisma.shareLink.create({
    data: {
      token,
      targetType,
      fileId: targetType === "FILE" ? fileId : null,
      folderId: targetType === "FOLDER" ? folderId : null,
      expiresAt: expiresAt ?? null,
      oneTime: oneTime ?? false,
      createdById: userId,
    },
  });

  try {
    await recordHistoryEvent({
      userId,
      action: "share_create",
      summary:
        targetType === "FILE"
          ? `Вы создали публичную ссылку для файла "${fileName ?? "файл"}"`
          : `Вы создали публичную ссылку для папки "${folderName ?? "папка"}"`,
      payload: {
        targetType,
        fileId: created.fileId,
        folderId: created.folderId,
        fileName,
        folderName,
        oneTime: created.oneTime,
        expiresAt: created.expiresAt?.toISOString() ?? null,
      },
    });
  } catch {
    // history must not break share operations
  }

  return created;
}

export async function resolveShareLink(token: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { file: true, folder: true },
  });
  if (!link) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  if (link.oneTime && link.usedAt) return null;
  return link;
}

export async function markShareLinkUsed(id: string) {
  return prisma.shareLink.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

export async function listShareLinks(
  userId: string,
  filters?: { fileId?: string | null; folderId?: string | null }
) {
  const where: { createdById: string; fileId?: string; folderId?: string } = {
    createdById: userId,
  };
  if (filters?.fileId) where.fileId = filters.fileId;
  if (filters?.folderId) where.folderId = filters.folderId;

  return prisma.shareLink.findMany({
    where,
    include: { file: true, folder: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteShareLink(id: string, userId: string) {
  const link = await prisma.shareLink.findFirst({
    where: { id, createdById: userId },
    include: {
      file: { select: { name: true } },
      folder: { select: { name: true } },
    },
  });
  if (!link) throw new Error("Ссылка не найдена");
  const deleted = await prisma.shareLink.delete({ where: { id } });

  try {
    await recordHistoryEvent({
      userId,
      action: "share_delete",
      summary:
        link.targetType === "FILE"
          ? `Вы удалили публичную ссылку для файла "${link.file?.name ?? "файл"}"`
          : `Вы удалили публичную ссылку для папки "${link.folder?.name ?? "папка"}"`,
      payload: {
        targetType: link.targetType,
        fileId: link.fileId,
        folderId: link.folderId,
        fileName: link.file?.name ?? null,
        folderName: link.folder?.name ?? null,
      },
    });
  } catch {
    // history must not break share operations
  }

  return deleted;
}

export async function canAccessFileViaShare(
  token: string,
  fileId: string
): Promise<{ file: { id: string; s3Key: string; name: string; mimeType: string }; shareLink: { id: string } } | null> {
  const link = await resolveShareLink(token);
  if (!link) return null;
  if (link.targetType === "FILE" && link.fileId === fileId) {
    if (!link.file) return null;
    return { file: link.file, shareLink: link };
  }
  if (link.targetType === "FOLDER" && link.folderId) {
    const folderIds = await getFolderAndDescendantIds(link.folderId);
    const file = await prisma.file.findFirst({
      where: { id: fileId, folderId: { in: folderIds } },
    });
    if (file) return { file, shareLink: link };
  }
  return null;
}

async function getFolderAndDescendantIds(folderId: string): Promise<string[]> {
  const ids = [folderId];
  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  for (const c of children) {
    ids.push(...(await getFolderAndDescendantIds(c.id)));
  }
  return ids;
}
