import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getMaxFileSize } from "@/lib/plan-service";
import { formatBytes } from "@/lib/utils";
import { buildS3Key } from "@/lib/file-service";
import { getPresignedUploadUrl } from "@/lib/s3-upload";
import { createUploadSessionToken } from "@/lib/upload-session";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = body as {
    name?: string;
    size?: number | string;
    mimeType?: string;
    folderId?: string | null;
    mediaDurationSeconds?: number | null;
    clientBatchId?: string | null;
  };

  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const size =
    typeof parsed.size === "number"
      ? parsed.size
      : typeof parsed.size === "string" && parsed.size.trim()
      ? Number(parsed.size)
      : NaN;
  const mimeType =
    typeof parsed.mimeType === "string" && parsed.mimeType
      ? parsed.mimeType
      : "application/octet-stream";
  const folderId =
    parsed.folderId && typeof parsed.folderId === "string" ? parsed.folderId : null;
  const mediaDurationSeconds =
    typeof parsed.mediaDurationSeconds === "number" &&
    Number.isFinite(parsed.mediaDurationSeconds) &&
    parsed.mediaDurationSeconds >= 0
      ? parsed.mediaDurationSeconds
      : null;
  const clientBatchId =
    typeof parsed.clientBatchId === "string" && parsed.clientBatchId.trim()
      ? parsed.clientBatchId.trim().slice(0, 128)
      : null;

  if (!name) {
    return NextResponse.json({ error: "Имя файла обязательно" }, { status: 400 });
  }
  if (size === 0) {
    return NextResponse.json({ error: "Пустые документы загружать нельзя" }, { status: 400 });
  }

  if (!Number.isFinite(size) || !Number.isInteger(size) || size < 0) {
    return NextResponse.json({ error: "Некорректный размер файла" }, { status: 400 });
  }

  const maxSize = await getMaxFileSize(userId);
  if (BigInt(size) > maxSize) {
    return NextResponse.json(
      { error: `Файл слишком большой. Максимум: ${formatBytes(Number(maxSize))}` },
      { status: 413 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageUsed: true, storageQuota: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.storageUsed + BigInt(size) > user.storageQuota) {
    return NextResponse.json({ error: "Превышен лимит хранилища" }, { status: 403 });
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: userId, deletedAt: null },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Папка не найдена" }, { status: 404 });
    }
  }

  const s3Key = buildS3Key({
    userId: userId,
    fileName: name,
    folderId,
  });

  const presigned = await getPresignedUploadUrl({
    s3Key,
    contentType: mimeType,
  });

  const uploadSessionToken = createUploadSessionToken({
    userId: userId,
    s3Key,
    name,
    mimeType,
    size,
    folderId,
    mediaDurationSeconds,
    clientBatchId,
  });

  return NextResponse.json({
    uploadUrl: presigned.url,
    uploadHeaders: presigned.headers,
    uploadSessionToken,
  });
}
