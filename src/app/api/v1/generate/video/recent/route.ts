import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

/**
 * GET /api/v1/generate/video/recent
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.videoGenerationTask.findMany({
    where: { userId, status: "success", fileId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { fileId: true },
  });

  const items: { fileId: string; url: string }[] = [];
  for (const t of tasks) {
    if (!t.fileId) continue;
    const file = await prisma.file.findFirst({
      where: { id: t.fileId, userId, deletedAt: null },
      select: { s3Key: true },
    });
    if (!file) continue;
    try {
      const url = await getPresignedDownloadUrl(file.s3Key, 3600);
      items.push({ fileId: t.fileId, url });
    } catch {
      // skip
    }
  }

  return NextResponse.json({ items });
}
