import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * GET /api/v1/files/:id/generation-url
 * Возвращает временный URL для использования в генерации изображений (Kie и т.д.).
 * Только для своих файлов и только для изображений. URL действителен 1 час.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: null },
    select: { s3Key: true, mimeType: true },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!IMAGE_MIMES.some((m) => file.mimeType.startsWith(m))) {
    return NextResponse.json(
      { error: "Файл должен быть изображением" },
      { status: 400 }
    );
  }

  const url = await getPresignedDownloadUrl(file.s3Key, 3600);
  return NextResponse.json({ url });
}
