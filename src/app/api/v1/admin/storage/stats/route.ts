import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalFiles,
    totalFolders,
    totalStorageStats,
    rootFilesCount,
    mimeTypeStats,
    topUsersByStorage,
    sharedFilesCount,
    recentFilesCount,
  ] = await Promise.all([
    // Total files and folders
    prisma.file.count(),
    prisma.folder.count(),
    
    // Total storage used
    prisma.file.aggregate({
      _sum: { size: true },
    }),
    
    // Files without folder (in root)
    prisma.file.count({ where: { folderId: null } }),
    
    // Files by mime type categories
    Promise.all([
      prisma.file.count({ where: { mimeType: { startsWith: "image/" } } }),
      prisma.file.count({ where: { mimeType: { startsWith: "video/" } } }),
      prisma.file.count({ where: { mimeType: { startsWith: "audio/" } } }),
      prisma.file.count({ 
        where: { 
          mimeType: { 
            in: [
              "application/pdf",
              "application/msword", 
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "text/plain"
            ]
          }
        }
      }),
    ]),
    
    // Top 5 users by storage used — считаем из реальных файлов, не из user.storageUsed
    prisma.file
      .groupBy({
        by: ["userId"],
        _sum: { size: true },
        _count: true,
      })
      .then(async (rows) => {
        const sorted = rows
          .map((r) => ({
            userId: r.userId,
            storageUsed: Number(r._sum.size ?? 0),
            filesCount: r._count,
          }))
          .sort((a, b) => b.storageUsed - a.storageUsed)
          .slice(0, 5);
        if (sorted.length === 0) return [];
        const users = await prisma.user.findMany({
          where: { id: { in: sorted.map((s) => s.userId) } },
          select: { id: true, email: true },
        });
        const byId = new Map(users.map((u) => [u.id, u]));
        return sorted.map((s) => ({
          id: s.userId,
          email: byId.get(s.userId)?.email ?? null,
          storageUsed: s.storageUsed,
          filesCount: s.filesCount,
        }));
      }),
    
    // Files with active share links
    prisma.file.count({
      where: {
        shareLinks: {
          some: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        }
      }
    }),
    
    // Files created in last 24 hours
    prisma.file.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
  ]);

  const [imagesCount, videosCount, audioCount, documentsCount] = mimeTypeStats;
  const otherFilesCount = totalFiles - imagesCount - videosCount - audioCount - documentsCount;

  return NextResponse.json({
    totals: {
      files: totalFiles,
      folders: totalFolders,
      storageUsed: Number(totalStorageStats._sum.size || 0),
      rootFiles: rootFilesCount,
      sharedFiles: sharedFilesCount,
      recentFiles: recentFilesCount,
    },
    mimeTypes: {
      images: imagesCount,
      videos: videosCount,
      audio: audioCount,
      documents: documentsCount,
      other: otherFilesCount,
    },
    topUsers: topUsersByStorage.map((user) => ({
      id: user.id,
      email: user.email,
      storageUsed: user.storageUsed,
      filesCount: user.filesCount,
    })),
  });
}