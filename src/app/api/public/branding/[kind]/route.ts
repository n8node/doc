import { NextResponse } from "next/server";
import { getBrandingAssetConfigKeys } from "@/lib/branding";
import { configStore } from "@/lib/config-store";
import { getStreamFromS3 } from "@/lib/s3-download";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ kind: string }> }
) {
  void request;
  const { kind } = await ctx.params;
  const keys = getBrandingAssetConfigKeys(kind);
  if (!keys) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let s3Key: string | null = null;
  let mimeType: string | null = null;
  try {
    [s3Key, mimeType] = await Promise.all([
      configStore.get(keys.keyKey),
      configStore.get(keys.mimeKey),
    ]);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!s3Key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getStreamFromS3(s3Key);
    const headers: HeadersInit = {
      "Content-Type": mimeType || contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    };
    if (contentLength != null) {
      headers["Content-Length"] = String(contentLength);
    }
    return new NextResponse(body as BodyInit, { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
