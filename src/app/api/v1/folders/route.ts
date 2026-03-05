import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/folder-service";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const scope = searchParams.get("scope");
  const hasShareLink = searchParams.get("hasShareLink");

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
    },
  });

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      createdAt: f.createdAt,
      hasShareLink: f.shareLinks.length > 0,
      shareLinksCount: f.shareLinks.length,
    })),
  });
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
