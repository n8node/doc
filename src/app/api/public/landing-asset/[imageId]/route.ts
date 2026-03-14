import { NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";
import { getLandingImageConfigKeys } from "@/lib/landing-content";
import { getStreamFromS3 } from "@/lib/s3-download";

export const dynamic = "force-dynamic";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await ctx.params;
  const keys = getLandingImageConfigKeys(imageId);
  if (!keys) {
    return new NextResponse(TRANSPARENT_GIF, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=3600" },
    });
  }

  const [s3Key, mimeType] = await Promise.all([
    configStore.get(keys.keyKey),
    configStore.get(keys.mimeKey),
  ]);

  if (!s3Key) {
    return new NextResponse(TRANSPARENT_GIF, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=3600" },
    });
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
  } catch (err) {
    console.error("[landing-asset] S3 getStream error:", { imageId, s3Key, err });
    return new NextResponse(TRANSPARENT_GIF, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=60" },
    });
  }
}
