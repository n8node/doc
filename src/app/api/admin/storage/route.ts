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
  const folderId = searchParams.get("folderId"); // null = root level
  const search = searchParams.get("search");
  const mimeTypeFilter = searchParams.get("mimeType");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  // Build where conditions
  const baseWhere: any = {};
  if (userId) baseWhere.userId = userId;

  const fileWhere = { 
    ...baseWhere,
    folderId: folderId || null,
  };
  const folderWhere = { 
    ...baseWhere,
    parentId: folderId || null,
  };

  // Add search filter
  if (search) {
    fileWhere.name = { contains: search, mode: "insensitive" };
    folderWhere.name = { contains: search, mode: "insensitive" };
  }

  // Add mime type filter for files
  if (mimeTypeFilter && mimeTypeFilter !== "all") {
    if (mimeTypeFilter === "image") {
      fileWhere.mimeType = { startsWith: "image/" };
    } else if (mimeTypeFilter === "video") {
      fileWhere.mimeType = { startsWith: "video/" };
    } else if (mimeTypeFilter === "audio") {
      fileWhere.mimeType = { startsWith: "audio/" };
    } else if (mimeTypeFilter === "document") {
      fileWhere.mimeType = { 
        in: [
          "application/pdf",
          "application/msword", 
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain"
        ]
      };
    }
  }

  const [files, folders, totalFiles, totalFolders] = await Promise.all([
    prisma.file.findMany({
      where: fileWhere,
      include: { 
        user: { select: { id: true, email: true } },
        shareLinks: { select: { id: true, token: true, expiresAt: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.folder.findMany({
      where: folderWhere,
      include: { 
        user: { select: { id: true, email: true } },
        _count: { select: { files: true, children: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.file.count({ where: fileWhere }),
    prisma.folder.count({ where: folderWhere }),
  ]);

  // Get folder size for each folder (sum of all files in folder recursively)
  const foldersWithStats = await Promise.all(
    folders.map(async (folder) => {
      const folderStats = await prisma.file.aggregate({
        where: { 
          OR: [
            { folderId: folder.id },
            { 
              folder: {
                OR: [
                  { parentId: folder.id },
                  { parent: { parentId: folder.id } },
                  { parent: { parent: { parentId: folder.id } } }, // 3 levels deep should be enough
                ]
              }
            }
          ]
        },
        _sum: { size: true },
        _count: true,
      });
      
      return {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        userId: folder.userId,
        userEmail: folder.user?.email,
        createdAt: folder.createdAt,
        filesCount: folder._count.files,
        childFoldersCount: folder._count.children,
        totalSize: Number(folderStats._sum.size || 0),
        totalFilesRecursive: folderStats._count,
      };
    })
  );

  // Build breadcrumb path if we're in a folder
  let breadcrumbs: Array<{id: string | null, name: string}> = [{ id: null, name: "Все файлы" }];
  if (folderId) {
    try {
      // Get folder path directly from database
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        select: { id: true, name: true, parentId: true }
      });
      
      if (folder) {
        const path = [];
        let currentFolder = folder;
        
        // Build path by walking up the parent chain
        while (currentFolder) {
          path.unshift({ id: currentFolder.id, name: currentFolder.name });
          if (currentFolder.parentId) {
            currentFolder = await prisma.folder.findUnique({
              where: { id: currentFolder.parentId },
              select: { id: true, name: true, parentId: true }
            });
          } else {
            currentFolder = null;
          }
        }
        
        breadcrumbs = [
          { id: null, name: "Все файлы" },
          ...path,
        ];
      }
    } catch (e) {
      // Ignore breadcrumb errors, use default
    }
  }

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
      hasShares: f.shareLinks.length > 0,
      shareLinksCount: f.shareLinks.length,
    })),
    folders: foldersWithStats,
    breadcrumbs,
    currentFolder: folderId,
    pagination: { 
      page, 
      limit, 
      totalFiles, 
      totalFolders, 
      total: totalFiles + totalFolders 
    },
  });
}
