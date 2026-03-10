import { NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";
import { getDashboardImageConfigKeys } from "@/lib/dashboard-content";
import { getStreamFromS3 } from "@/lib/s3-download";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await ctx.params;
  const keys = getDashboardImageConfigKeys(imageId);
  if (!keys) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [s3Key, mimeType] = await Promise.all([
    configStore.get(keys.keyKey),
    configStore.get(keys.mimeKey),
  ]);

  if (!s3Key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getStreamFromS3(s3Key);
    const headers: HeadersInit = {
      "Content-Type": mimeType || contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength != null) {
      headers["Content-Length"] = String(contentLength);
    }
    return new NextResponse(body as BodyInit, { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
