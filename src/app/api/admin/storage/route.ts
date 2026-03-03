import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const where = userId ? { userId } : {};
  const [files, folders, totalFiles, totalFolders] = await Promise.all([
    prisma.file.findMany({
      where,
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.folder.findMany({
      where,
      include: { user: { select: { id: true, email: true } } },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.file.count({ where }),
    prisma.folder.count({ where }),
  ]);
  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      userId: f.userId,
      userEmail: f.user?.email,
      folderId: f.folderId,
      createdAt: f.createdAt,
    })),
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      userId: f.userId,
      userEmail: f.user?.email,
      createdAt: f.createdAt,
    })),
    pagination: { page, limit, totalFiles, totalFolders, total: totalFiles + totalFolders },
  });
}
