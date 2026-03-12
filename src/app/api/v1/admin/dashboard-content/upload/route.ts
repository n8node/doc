import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import {
  isValidDashboardImageId,
  getDashboardImageConfigKeys,
  getDashboardAssetUrl,
} from "@/lib/dashboard-content";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function parseImageId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (isValidDashboardImageId(value)) return value;
  return null;
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "asset";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const imageId = parseImageId(formData.get("imageId"));
  const fileRaw = formData.get("file");

  if (!imageId) {
    return NextResponse.json(
      { error: "Некорректный imageId. Допустимы: hero или card_*" },
      { status: 400 }
    );
  }

  const keys = getDashboardImageConfigKeys(imageId);
  if (!keys) {
    return NextResponse.json({ error: "Некорректный imageId" }, { status: 400 });
  }

  if (!(fileRaw instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (fileRaw.size <= 0 || fileRaw.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Размер файла от 1 байта до 5 МБ" },
      { status: 400 }
    );
  }

  const mime = fileRaw.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Формат: PNG, JPEG, WebP, SVG" },
      { status: 400 }
    );
  }

  const s3 = await getS3Config();
  const client = createS3Client({ ...s3, forcePathStyle: true });
  const cleanName = sanitizeName(fileRaw.name || "image.bin");
  const s3Key = `dashboard/${imageId}/${Date.now()}-${cleanName}`;
  const body = Buffer.from(await fileRaw.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: s3Key,
      Body: body,
      ContentType: mime,
      CacheControl: "public, max-age=3600",
    })
  );

  await Promise.all([
    configStore.set(keys.keyKey, s3Key, {
      category: "dashboard",
      description: `S3 key для изображения ${imageId}`,
    }),
    configStore.set(keys.mimeKey, mime, {
      category: "dashboard",
      description: `MIME для изображения ${imageId}`,
    }),
  ]);

  configStore.invalidate(keys.keyKey);
  configStore.invalidate(keys.mimeKey);

  return NextResponse.json({
    ok: true,
    url: `${getDashboardAssetUrl(imageId)}?v=${Date.now()}`,
  });
}
