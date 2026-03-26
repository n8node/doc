import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/folder-service";
import { listActiveIncomingSharedFolderGrantsForMerge } from "@/lib/collaborative-share-service";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const scope = searchParams.get("scope");
  const hasShareLink = searchParams.get("hasShareLink");
  const mergeIncomingShared = searchParams.get("mergeIncomingShared") === "true";

  const where: {
    userId: string;
    deletedAt: null;
    parentId?: string | null;
    shareLinks?: { some: { OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }> } };
  } = {
    userId,
    deletedAt: null,
  };

  if (scope !== "all") {
    where.parentId = parentId || null;
  }

  if (hasShareLink === "true") {
    where.shareLinks = {
      some: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };
  }

  const folders = await prisma.folder.findMany({
    where,
    orderBy: { name: "asc" },
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
      shareGrants: {
        where: { status: { in: ["PENDING", "ACTIVE"] } },
        select: { id: true },
      },
    },
  });

  const mapOwned = (f: (typeof folders)[0]) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    createdAt: f.createdAt,
    hasShareLink: f.shareLinks.length > 0,
    shareLinksCount: f.shareLinks.length,
    filesCount: f.files.length,
    emailShareGrantsCount: f.shareGrants.length,
    isIncomingShared: false as const,
  });

  type OwnedFolderRow = ReturnType<typeof mapOwned>;
  type IncomingSharedMergedFolderRow = Omit<OwnedFolderRow, "isIncomingShared"> & {
    isIncomingShared: true;
    sharedGrantId: string;
    sharedFrom: { name: string | null; email: string | null };
  };

  const merged: Array<OwnedFolderRow | IncomingSharedMergedFolderRow> =
    folders.map(mapOwned);

  if (mergeIncomingShared && hasShareLink !== "true" && scope !== "all") {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (me?.email) {
      const grants = await listActiveIncomingSharedFolderGrantsForMerge(userId, me.email);
      const incoming = grants
        .filter((g) => g.folder)
        .map((g) => {
          const fo = g.folder!;
          return {
            id: fo.id,
            name: fo.name,
            parentId: fo.parentId,
            createdAt: fo.createdAt,
            hasShareLink: false,
            shareLinksCount: 0,
            filesCount: fo.files.length,
            emailShareGrantsCount: 0,
            isIncomingShared: true as const,
            sharedGrantId: g.id,
            sharedFrom: {
              name: g.owner.name,
              email: g.owner.email,
            },
          };
        });

      const seen = new Set(merged.map((x) => x.id));
      for (const row of incoming) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          merged.push(row);
        }
      }
      merged.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
  }

  return NextResponse.json({ folders: merged });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, parentId } = body;
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const folder = await createFolder(
      name,
      parentId && typeof parentId === "string" ? parentId : null,
      userId
    );
    return NextResponse.json(folder);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
