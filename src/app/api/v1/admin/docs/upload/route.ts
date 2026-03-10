import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";
import { nanoid } from "nanoid";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "image";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const fileRaw = formData.get("file");

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
      { error: "Формат: PNG, JPEG, WebP, GIF, SVG" },
      { status: 400 }
    );
  }

  const s3 = await getS3Config();
  const client = createS3Client({ ...s3, forcePathStyle: true });
  const ext = mime.split("/")[1] || "bin";
  const cleanName = sanitizeName(fileRaw.name || "image") || "image";
  const s3Key = `docs/${nanoid(12)}-${cleanName}.${ext}`;
  const body = Buffer.from(await fileRaw.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: s3Key,
      Body: body,
      ContentType: mime,
      CacheControl: "public, max-age=31536000",
    })
  );

  const url = `/api/public/doc-asset/${s3Key.split("/").map(encodeURIComponent).join("/")}`;
  return NextResponse.json({ ok: true, url });
}
