import { nanoid } from "nanoid";
import { prisma } from "./prisma";

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

  if (targetType === "FILE") {
    const file = await prisma.file.findFirst({
      where: { id: fileId!, userId },
    });
    if (!file) throw new Error("Файл не найден");
  } else {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId!, userId },
    });
    if (!folder) throw new Error("Папка не найдена");
  }

  const token = nanoid(12);

  return prisma.shareLink.create({
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

export async function listShareLinks(userId: string) {
  return prisma.shareLink.findMany({
    where: { createdById: userId },
    include: { file: true, folder: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteShareLink(id: string, userId: string) {
  const link = await prisma.shareLink.findFirst({
    where: { id, createdById: userId },
  });
  if (!link) throw new Error("Ссылка не найдена");
  return prisma.shareLink.delete({ where: { id } });
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
