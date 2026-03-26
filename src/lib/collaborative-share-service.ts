import { prisma } from "./prisma";
import type { File, Folder, ShareGrant } from "@prisma/client";
import { recordHistoryEvent } from "./history-service";
import { sendEmail } from "./email-sender";
import { getPublicBaseUrl } from "./app-url";
import { normalizeShareEmail, parseEmailList } from "./share-email-parse";
import { createNotificationIfEnabled } from "./notification-service";

async function findUserIdByShareEmail(recipientEmail: string): Promise<string | null> {
  const row = await prisma.user.findFirst({
    where: { email: { equals: recipientEmail, mode: "insensitive" } },
    select: { id: true },
  });
  return row?.id ?? null;
}

export const SHARED_ACCESS_EMAIL_FEATURE = "shared_access_email";

export { normalizeShareEmail, parseEmailList };

export function buildShareTargetKey(targetType: "FILE" | "FOLDER", id: string): string {
  return targetType === "FILE" ? `file:${id}` : `folder:${id}`;
}

function grantTimeValid(g: { expiresAt: Date | null }): boolean {
  if (!g.expiresAt) return true;
  return g.expiresAt > new Date();
}

/** Проверка: folderId (потомок) лежит внутри дерева rootFolderId. */
export async function isFolderUnderSharedRoot(
  folderId: string,
  rootFolderId: string,
  ownerUserId: string
): Promise<boolean> {
  let current: string | null = folderId;
  let depth = 0;
  while (current != null && depth < 200) {
    if (current === rootFolderId) return true;
    const row: { parentId: string | null } | null = await prisma.folder.findFirst({
      where: { id: current, userId: ownerUserId, deletedAt: null },
      select: { parentId: true },
    });
    if (!row) return false;
    current = row.parentId;
    depth += 1;
  }
  return false;
}

/** Файл доступен по гранту на папку (файл внутри дерева папки). */
export async function isFileCoveredByFolderGrant(
  file: Pick<File, "folderId" | "id">,
  folderGrantId: string,
  ownerUserId: string
): Promise<boolean> {
  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: folderGrantId,
      ownerUserId,
      targetType: "FOLDER",
      status: "ACTIVE",
    },
    select: { folderId: true },
  });
  if (!grant?.folderId) return false;
  if (!file.folderId) return false;
  return isFolderUnderSharedRoot(file.folderId, grant.folderId, ownerUserId);
}

/**
 * Активный грант получателя на файл (прямой или через папку).
 */
export async function findActiveGrantForRecipientFile(
  recipientUserId: string,
  file: File
): Promise<ShareGrant | null> {
  if (file.userId === recipientUserId) return null;
  if (file.deletedAt) return null;

  const grants = await prisma.shareGrant.findMany({
    where: {
      recipientUserId,
      ownerUserId: file.userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  for (const g of grants) {
    if (!grantTimeValid(g)) continue;
    if (g.targetType === "FILE" && g.fileId === file.id) return g;
    if (g.targetType === "FOLDER" && g.folderId && file.folderId) {
      const under = await isFolderUnderSharedRoot(
        file.folderId,
        g.folderId,
        file.userId
      );
      if (under || file.folderId === g.folderId) return g;
    }
  }
  return null;
}

export type FileAccessMode =
  | { mode: "owner"; file: File }
  | {
      mode: "shared";
      file: File;
      grant: ShareGrant;
      canUseCollections: boolean;
      canUseAi: boolean;
    }
  | { mode: "none" };

export async function resolveFileAccessForUser(
  userId: string,
  fileId: string
): Promise<FileAccessMode> {
  const file = await prisma.file.findFirst({
    where: { id: fileId, deletedAt: null },
  });
  if (!file) return { mode: "none" };

  if (file.userId === userId) {
    return { mode: "owner", file };
  }

  const grant = await findActiveGrantForRecipientFile(userId, file);
  if (!grant) return { mode: "none" };

  return {
    mode: "shared",
    file,
    grant,
    canUseCollections: grant.allowCollections,
    canUseAi: grant.allowAiFeatures,
  };
}

export async function resolveFolderAccessForUser(
  userId: string,
  folderId: string
): Promise<
  | { mode: "owner"; folder: Folder }
  | { mode: "shared"; folder: Folder; grant: ShareGrant }
  | { mode: "none" }
> {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, deletedAt: null },
  });
  if (!folder) return { mode: "none" };
  if (folder.userId === userId) return { mode: "owner", folder };

  const grants = await prisma.shareGrant.findMany({
    where: {
      recipientUserId: userId,
      ownerUserId: folder.userId,
      status: "ACTIVE",
      targetType: "FOLDER",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  for (const g of grants) {
    if (!grantTimeValid(g) || !g.folderId) continue;
    if (folder.id === g.folderId) {
      return { mode: "shared", folder, grant: g };
    }
    const under = await isFolderUnderSharedRoot(folder.id, g.folderId, folder.userId);
    if (under) return { mode: "shared", folder, grant: g };
  }
  return { mode: "none" };
}

/** Подтвердить, что папка внутри расшаренного дерева для гранта (папка). */
export async function assertFolderReachableViaGrant(
  grant: ShareGrant,
  folderId: string
): Promise<boolean> {
  if (grant.targetType !== "FOLDER" || !grant.folderId) return false;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: grant.ownerUserId, deletedAt: null },
  });
  if (!folder) return false;
  if (folder.id === grant.folderId) return true;
  return isFolderUnderSharedRoot(folder.id, grant.folderId, grant.ownerUserId);
}

export async function linkPendingGrantsToUser(
  userId: string,
  email: string
): Promise<number> {
  const normalized = normalizeShareEmail(email);
  const updated = await prisma.shareGrant.updateMany({
    where: {
      recipientEmail: normalized,
      recipientUserId: null,
      status: "PENDING",
    },
    data: { recipientUserId: userId },
  });
  return updated.count;
}

export async function expireStaleShareGrants(): Promise<number> {
  const now = new Date();
  const res = await prisma.shareGrant.updateMany({
    where: {
      status: { in: ["PENDING", "ACTIVE"] },
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
    },
  });
  return res.count;
}

export interface CreateShareGrantsInput {
  ownerUserId: string;
  targetType: "FILE" | "FOLDER";
  fileId?: string | null;
  folderId?: string | null;
  emails: string[];
  allowCollections: boolean;
  allowAiFeatures: boolean;
  expiresAt: Date | null;
}

export async function createShareGrants(input: CreateShareGrantsInput) {
  const {
    ownerUserId,
    targetType,
    fileId,
    folderId,
    emails,
    allowCollections,
    allowAiFeatures,
    expiresAt,
  } = input;

  let file: File | null = null;
  let folder: Folder | null = null;
  let shareTargetKey: string;

  if (targetType === "FILE") {
    if (!fileId) throw new Error("fileId required");
    file = await prisma.file.findFirst({
      where: { id: fileId, userId: ownerUserId, deletedAt: null },
    });
    if (!file) throw new Error("Файл не найден");
    shareTargetKey = buildShareTargetKey("FILE", file.id);
  } else {
    if (!folderId) throw new Error("folderId required");
    folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: ownerUserId, deletedAt: null },
    });
    if (!folder) throw new Error("Папка не найдена");
    shareTargetKey = buildShareTargetKey("FOLDER", folder.id);
  }

  const created: ShareGrant[] = [];
  for (const emailRaw of emails) {
    const recipientEmail = normalizeShareEmail(emailRaw);
    const existingUserId = await findUserIdByShareEmail(recipientEmail);
    if (existingUserId === ownerUserId) continue;

    try {
      const g = await prisma.shareGrant.create({
        data: {
          ownerUserId,
          recipientEmail,
          recipientUserId: existingUserId,
          targetType,
          shareTargetKey,
          fileId: file?.id ?? null,
          folderId: folder?.id ?? null,
          status: "PENDING",
          allowCollections,
          allowAiFeatures,
          expiresAt,
        },
      });
      created.push(g);
    } catch {
      // unique violation — skip duplicate
    }
  }

  const targetName = file?.name ?? folder?.name ?? "объект";
  try {
    await recordHistoryEvent({
      userId: ownerUserId,
      action: "share_grant_create",
      summary: `Приглашение к совместному доступу: «${targetName}» (${created.length} адр.)`,
      payload: {
        targetType,
        fileId: file?.id ?? null,
        folderId: folder?.id ?? null,
        count: created.length,
      },
    });
  } catch {
    /* ignore */
  }

  const base = getPublicBaseUrl().replace(/\/$/, "");
  for (const g of created) {
    const link = `${base}/dashboard/files?section=shared-with-me&pending=1`;
    await sendEmail({
      to: g.recipientEmail,
      subject: `Вам открыли доступ: ${targetName}`,
      text: `Вам предоставлен доступ к «${targetName}». Откройте сервис и примите приглашение в разделе «Доступно мне»: ${link}`,
      html: `<p>Вам предоставлен доступ к «${targetName}».</p><p><a href="${link}">Открыть «Доступно мне»</a></p>`,
    }).catch(() => {});
    if (g.recipientUserId) {
      createNotificationIfEnabled({
        userId: g.recipientUserId,
        type: "SHARE_GRANT",
        category: "info",
        title: `Вам открыли доступ: ${targetName}`,
        body: "Откройте «Файлы» → «Доступно мне» и примите приглашение.",
        payload: { grantId: g.id, targetType: g.targetType },
      }).catch(() => {});
    }
  }

  return created;
}

export async function acceptShareGrant(
  grantId: string,
  recipientUserId: string,
  recipientEmail: string
) {
  const email = normalizeShareEmail(recipientEmail);
  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: grantId,
      status: "PENDING",
      OR: [{ recipientUserId }, { recipientEmail: email, recipientUserId: null }],
    },
  });
  if (!grant) throw new Error("Приглашение не найдено");
  if (grant.recipientUserId && grant.recipientUserId !== recipientUserId) {
    throw new Error("Приглашение не найдено");
  }
  if (grant.expiresAt && grant.expiresAt <= new Date()) {
    await prisma.shareGrant.update({
      where: { id: grant.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Срок приглашения истёк");
  }

  const updated = await prisma.shareGrant.update({
    where: { id: grant.id },
    data: {
      status: "ACTIVE",
      acceptedAt: new Date(),
      recipientUserId,
    },
  });

  try {
    await recordHistoryEvent({
      userId: recipientUserId,
      action: "share_grant_accept",
      summary: `Вы приняли доступ к расшаренному объекту`,
      payload: { grantId: grant.id, targetType: grant.targetType },
    });
  } catch {
    /* ignore */
  }

  return updated;
}

export async function declineShareGrant(
  grantId: string,
  recipientUserId: string,
  recipientEmail: string
) {
  const email = normalizeShareEmail(recipientEmail);
  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: grantId,
      status: "PENDING",
      OR: [{ recipientUserId }, { recipientEmail: email, recipientUserId: null }],
    },
  });
  if (!grant) throw new Error("Приглашение не найдено");
  if (grant.recipientUserId && grant.recipientUserId !== recipientUserId) {
    throw new Error("Приглашение не найдено");
  }

  await prisma.shareGrant.update({
    where: { id: grant.id },
    data: { status: "DECLINED", declinedAt: new Date(), recipientUserId },
  });
}

/** Получатель отказывается от приглашения (PENDING → DECLINED) или снимает принятый доступ (ACTIVE → REVOKED). */
export async function withdrawShareGrantAsRecipient(
  grantId: string,
  recipientUserId: string,
  recipientEmail: string
) {
  const email = normalizeShareEmail(recipientEmail);
  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: grantId,
      status: { in: ["PENDING", "ACTIVE"] },
      OR: [{ recipientUserId }, { recipientEmail: email, recipientUserId: null }],
    },
  });
  if (!grant) throw new Error("Запись не найдена");
  if (grant.recipientUserId && grant.recipientUserId !== recipientUserId) {
    throw new Error("Запись не найдена");
  }

  if (grant.status === "PENDING") {
    await prisma.shareGrant.update({
      where: { id: grant.id },
      data: { status: "DECLINED", declinedAt: new Date(), recipientUserId },
    });
    return;
  }

  await prisma.shareGrant.update({
    where: { id: grant.id },
    data: { status: "REVOKED", revokedAt: new Date(), recipientUserId },
  });
}

export async function revokeShareGrant(grantId: string, ownerUserId: string) {
  const grant = await prisma.shareGrant.findFirst({
    where: { id: grantId, ownerUserId, status: { in: ["PENDING", "ACTIVE"] } },
    include: {
      file: { select: { name: true } },
      folder: { select: { name: true } },
    },
  });
  if (!grant) throw new Error("Запись не найдена");

  const previousStatus = grant.status;

  await prisma.shareGrant.update({
    where: { id: grant.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  const targetName =
    grant.targetType === "FILE"
      ? grant.file?.name ?? "файл"
      : grant.folder?.name ?? "папка";

  const recipientUserId =
    grant.recipientUserId ??
    (await findUserIdByShareEmail(grant.recipientEmail));

  if (recipientUserId) {
    const wasActive = previousStatus === "ACTIVE";
    createNotificationIfEnabled({
      userId: recipientUserId,
      type: "SHARE_GRANT",
      category: "warning",
      title: wasActive ? "Доступ отозван" : "Приглашение отозвано",
      body: wasActive
        ? `Владелец закрыл доступ к «${targetName}».`
        : `Приглашение к «${targetName}» больше не действует.`,
      payload: {
        grantId: grant.id,
        targetType: grant.targetType,
        revoked: true,
      },
    }).catch(() => {});
  }
}

export async function listOutgoingGrantsForTarget(
  ownerUserId: string,
  targetType: "FILE" | "FOLDER",
  fileId: string | null,
  folderId: string | null
) {
  const key = buildShareTargetKey(
    targetType,
    (targetType === "FILE" ? fileId : folderId)!
  );
  return prisma.shareGrant.findMany({
    where: { ownerUserId, shareTargetKey: key },
    orderBy: { createdAt: "desc" },
    include: {
      recipient: { select: { id: true, email: true, name: true } },
    },
  });
}

/** ACTIVE гранты на файлы для показа в «Мои файлы» / «Недавние» (корень и scope=all). */
export async function listActiveIncomingSharedFileGrantsForMerge(
  recipientUserId: string,
  recipientEmail: string
) {
  const email = normalizeShareEmail(recipientEmail);
  return prisma.shareGrant.findMany({
    where: {
      status: "ACTIVE",
      targetType: "FILE",
      OR: [{ recipientUserId }, { recipientEmail: email, recipientUserId: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      file: { is: { deletedAt: null } },
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      file: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          size: true,
          s3Key: true,
          folderId: true,
          mediaMetadata: true,
          aiMetadata: true,
          hasEmbedding: true,
          createdAt: true,
          shareLinks: {
            where: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true },
          },
          sheetsFromFile: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true },
          },
        },
      },
    },
  });
}

/** ACTIVE гранты на папки для корня «Мои файлы». */
export async function listActiveIncomingSharedFolderGrantsForMerge(
  recipientUserId: string,
  recipientEmail: string
) {
  const email = normalizeShareEmail(recipientEmail);
  return prisma.shareGrant.findMany({
    where: {
      status: "ACTIVE",
      targetType: "FOLDER",
      OR: [{ recipientUserId }, { recipientEmail: email, recipientUserId: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      folder: { is: { deletedAt: null } },
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      folder: {
        select: {
          id: true,
          name: true,
          parentId: true,
          createdAt: true,
          shareLinks: {
            where: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true },
          },
          files: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
}

export async function listIncomingGrants(recipientUserId: string, recipientEmail: string) {
  const email = normalizeShareEmail(recipientEmail);
  return prisma.shareGrant.findMany({
    where: {
      status: { in: ["PENDING", "ACTIVE"] },
      OR: [
        { recipientUserId },
        { recipientEmail: email, recipientUserId: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      file: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          folderId: true,
          size: true,
          createdAt: true,
        },
      },
      folder: { select: { id: true, name: true, parentId: true, createdAt: true } },
    },
  });
}

/**
 * Содержимое расшаренной папки или один файл (parentFolderId = null → корень шаринга).
 */
export async function browseSharedGrantContents(
  grantId: string,
  recipientUserId: string,
  recipientEmail: string,
  parentFolderId: string | null
) {
  const email = normalizeShareEmail(recipientEmail);
  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: grantId,
      status: "ACTIVE",
      OR: [
        { recipientUserId },
        { recipientEmail: email, recipientUserId: null },
      ],
    },
    include: {
      file: true,
      folder: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!grant || !grantTimeValid(grant)) {
    throw new Error("Нет доступа");
  }
  if (grant.recipientUserId && grant.recipientUserId !== recipientUserId) {
    throw new Error("Нет доступа");
  }

  if (grant.targetType === "FILE" && grant.file) {
    const f = await prisma.file.findFirst({
      where: { id: grant.file.id, deletedAt: null },
    });
    if (!f) throw new Error("Файл не найден");
    return {
      grant,
      owner: grant.owner,
      folders: [] as Folder[],
      files: [f],
      currentFolderId: null as string | null,
      navUpFolderId: null as string | null,
    };
  }

  if (grant.targetType === "FOLDER" && grant.folderId) {
    const rootId = grant.folderId;
    const listInFolderId = parentFolderId ?? rootId;

    if (listInFolderId !== rootId) {
      const ok = await isFolderUnderSharedRoot(
        listInFolderId,
        rootId,
        grant.ownerUserId
      );
      if (!ok) throw new Error("Папка вне доступа");
    }

    const [folders, files] = await Promise.all([
      prisma.folder.findMany({
        where: {
          userId: grant.ownerUserId,
          parentId: listInFolderId,
          deletedAt: null,
        },
        orderBy: { name: "asc" },
      }),
      prisma.file.findMany({
        where: {
          userId: grant.ownerUserId,
          folderId: listInFolderId,
          deletedAt: null,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    let navUpFolderId: string | null = null;
    if (listInFolderId !== rootId) {
      const cur = await prisma.folder.findFirst({
        where: { id: listInFolderId, userId: grant.ownerUserId, deletedAt: null },
        select: { parentId: true },
      });
      const p = cur?.parentId ?? null;
      if (p === rootId || p === null) navUpFolderId = null;
      else navUpFolderId = p;
    }

    return {
      grant,
      owner: grant.owner,
      folders,
      files,
      currentFolderId: listInFolderId,
      navUpFolderId,
    };
  }

  throw new Error("Некорректный грант");
}

export async function resolveRecipientEmails(
  emails: string[]
): Promise<Array<{ email: string; userId: string | null }>> {
  const normalized = Array.from(
    new Set(emails.map(normalizeShareEmail).filter((e) => e.length > 0))
  );
  if (normalized.length === 0) return [];
  const users =
    normalized.length === 0
      ? []
      : await prisma.user.findMany({
          where: {
            OR: normalized.map((e) => ({
              email: { equals: e, mode: "insensitive" as const },
            })),
          },
          select: { id: true, email: true },
        });
  const byEmail = new Map(users.map((u) => [normalizeShareEmail(u.email), u.id]));
  return normalized.map((email) => ({
    email,
    userId: byEmail.get(email) ?? null,
  }));
}
