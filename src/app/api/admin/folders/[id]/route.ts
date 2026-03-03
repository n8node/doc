import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteFolderRecursive } from "@/lib/folder-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const { id } = await ctx.params;
  
  try {
    const folder = await prisma.folder.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: {
          select: {
            files: true,
            children: true,
            shareLinks: true,
          }
        }
      }
    });
    
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    
    // Get total size recursively
    const sizeStats = await prisma.file.aggregate({
      where: {
        OR: [
          { folderId: folder.id },
          {
            folder: {
              OR: [
                { parentId: folder.id },
                { parent: { parentId: folder.id } },
                { parent: { parent: { parentId: folder.id } } },
              ]
            }
          }
        ]
      },
      _sum: { size: true },
      _count: true,
    });
    
    return NextResponse.json({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      parent: folder.parent,
      userId: folder.userId,
      user: folder.user,
      directFilesCount: folder._count.files,
      childFoldersCount: folder._count.children,
      shareLinksCount: folder._count.shareLinks,
      totalSize: Number(sizeStats._sum.size || 0),
      totalFilesRecursive: sizeStats._count,
      createdAt: folder.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch folder" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const { id } = await ctx.params;
  const body = await request.json();
  const { name } = body;
  
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  
  try {
    const folder = await prisma.folder.update({
      where: { id },
      data: { name: name.trim() },
      include: { user: { select: { email: true } } }
    });
    
    return NextResponse.json({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      userId: folder.userId,
      userEmail: folder.user?.email,
      createdAt: folder.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder)
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  await deleteFolderRecursive(id, folder.userId);
  return NextResponse.json({ ok: true });
}
