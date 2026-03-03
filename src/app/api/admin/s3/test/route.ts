import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const useBody =
    body?.endpoint &&
    body?.bucket &&
    body?.accessKeyId &&
    body?.secretAccessKey;

  const config = useBody
    ? {
        endpoint: body.endpoint,
        bucket: body.bucket,
        region: body.region ?? "ru-central1",
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        forcePathStyle: true,
      }
    : { ...(await getS3Config()), forcePathStyle: true };

  try {
    const client = createS3Client(config);
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return NextResponse.json({ ok: true, message: "Подключение успешно" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return NextResponse.json(
      { ok: false, message: `Ошибка: ${msg}` },
      { status: 400 }
    );
  }
}
