import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { S3_DEFAULTS } from "@/lib/s3-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [endpoint, bucket, region, accessKeyId, secretAccessKey] =
    await Promise.all([
      configStore.get("s3.endpoint"),
      configStore.get("s3.bucket"),
      configStore.get("s3.region"),
      configStore.get("s3.access_key_id"),
      configStore.get("s3.secret_access_key"),
    ]);

  return NextResponse.json({
    endpoint: endpoint ?? S3_DEFAULTS.endpoint,
    bucket: bucket ?? S3_DEFAULTS.bucket,
    region: region ?? S3_DEFAULTS.region,
    accessKeyId: accessKeyId ?? S3_DEFAULTS.accessKeyId,
    secretAccessKey: secretAccessKey ?? S3_DEFAULTS.secretAccessKey,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { endpoint, bucket, region, accessKeyId, secretAccessKey } = body;

  if (!endpoint || !bucket || !accessKeyId) {
    return NextResponse.json(
      { error: "Обязательны: endpoint, bucket, accessKeyId" },
      { status: 400 }
    );
  }

  const updates: Promise<void>[] = [
    configStore.set("s3.endpoint", endpoint, {
      category: "storage",
      description: "S3 endpoint URL",
    }),
    configStore.set("s3.bucket", bucket, {
      category: "storage",
      description: "S3 bucket name",
    }),
    configStore.set("s3.region", region ?? "ru-central1", {
      category: "storage",
      description: "S3 region",
    }),
    configStore.set("s3.access_key_id", accessKeyId, {
      category: "storage",
      description: "S3 access key",
    }),
  ];

  if (secretAccessKey && typeof secretAccessKey === "string" && secretAccessKey.trim()) {
    updates.push(
      configStore.set("s3.secret_access_key", secretAccessKey.trim(), {
        isEncrypted: true,
        category: "storage",
        description: "S3 secret key",
      })
    );
  }

  await Promise.all(updates);

  configStore.invalidate("s3.endpoint");
  configStore.invalidate("s3.bucket");
  configStore.invalidate("s3.region");
  configStore.invalidate("s3.access_key_id");
  configStore.invalidate("s3.secret_access_key");

  return NextResponse.json({ ok: true });
}
