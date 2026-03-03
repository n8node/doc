import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-service";
import { getMaxFileSize } from "@/lib/plan-service";
import { formatBytes } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

  const maxSize = await getMaxFileSize(session.user.id);
  if (BigInt(file.size) > maxSize) {
    return NextResponse.json(
      { error: `Файл слишком большой. Максимум: ${formatBytes(Number(maxSize))}` },
      { status: 413 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const quota = user.storageQuota;
  const used = user.storageUsed;
  if (used + BigInt(file.size) > quota) {
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
      userId: session.user.id,
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
