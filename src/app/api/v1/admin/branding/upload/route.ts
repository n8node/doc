import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getBrandingAssetConfigKeys, getBrandingAssetUrl } from "@/lib/branding";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const FAVICON_MIME = new Set(["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"]);

function sanitizeName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "asset"
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const kindRaw = formData.get("kind");
  const fileRaw = formData.get("file");
  if (typeof kindRaw !== "string") {
    return NextResponse.json({ error: "kind обязателен" }, { status: 400 });
  }
  const keys = getBrandingAssetConfigKeys(kindRaw);
  if (!keys) {
    return NextResponse.json({ error: "Некорректный kind" }, { status: 400 });
  }
  if (!(fileRaw instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (fileRaw.size <= 0 || fileRaw.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Размер файла должен быть от 1B до 2MB" }, { status: 400 });
  }

  const mime = fileRaw.type || "application/octet-stream";
  const allowSet = kindRaw === "logo" ? LOGO_MIME : FAVICON_MIME;
  if (!allowSet.has(mime)) {
    return NextResponse.json({ error: "Неподдерживаемый формат файла" }, { status: 400 });
  }

  const s3 = await getS3Config();
  const client = createS3Client({ ...s3, forcePathStyle: true });
  const cleanName = sanitizeName(fileRaw.name || `${kindRaw}.bin`);
  const s3Key = `branding/${kindRaw}/${Date.now()}-${cleanName}`;
  const body = Buffer.from(await fileRaw.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: s3Key,
      Body: body,
      ContentType: mime,
      CacheControl: "public, max-age=300",
    })
  );

  await Promise.all([
    configStore.set(keys.keyKey, s3Key, {
      category: "branding",
      description: `S3 key для ${kindRaw}`,
    }),
    configStore.set(keys.mimeKey, mime, {
      category: "branding",
      description: `MIME для ${kindRaw}`,
    }),
  ]);

  configStore.invalidate(keys.keyKey);
  configStore.invalidate(keys.mimeKey);

  return NextResponse.json({
    ok: true,
    url: `${getBrandingAssetUrl(kindRaw)}?v=${Date.now()}`,
  });
}
