import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { createNotificationIfEnabled } from "@/lib/notification-service";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-service";
import { getMaxFileSize } from "@/lib/plan-service";
import { formatBytes } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folderId = formData.get("folderId");
  const durationStr = formData.get("duration");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Файл не передан" },
      { status: 400 }
    );
  }

  const maxSize = await getMaxFileSize(userId);
  if (BigInt(file.size) > maxSize) {
    return NextResponse.json(
      { error: `Файл слишком большой. Максимум: ${formatBytes(Number(maxSize))}` },
      { status: 413 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const quota = user.storageQuota;
  const used = user.storageUsed;
  if (used + BigInt(file.size) > quota) {
    createNotificationIfEnabled({
      userId,
      type: "STORAGE",
      category: "error",
      title: "Хранилище переполнено",
      body: "Превышен лимит хранилища. Удалите файлы или смените тариф.",
    }).catch(() => {});
    return NextResponse.json(
      { error: "Превышен лимит хранилища" },
      { status: 403 }
    );
  }

  let mediaDurationSeconds: number | null = null;
  if (durationStr && typeof durationStr === "string") {
    const d = parseFloat(durationStr);
    if (!Number.isNaN(d) && d >= 0) mediaDurationSeconds = d;
  }

  try {
    const created = await uploadFile({
      userId,
      file,
      folderId: folderId && typeof folderId === "string" ? folderId : null,
      mediaDurationSeconds,
    });
    return NextResponse.json({
      id: created.id,
      name: created.name,
      mimeType: created.mimeType,
      size: Number(created.size),
      s3Key: created.s3Key,
      folderId: created.folderId,
      mediaMetadata: created.mediaMetadata,
      createdAt: created.createdAt,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки" },
      { status: 500 }
    );
  }
}
