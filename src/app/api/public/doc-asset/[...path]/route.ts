import { NextResponse } from "next/server";
import { getStreamFromS3 } from "@/lib/s3-download";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { path: pathSegments } = await ctx.params;
  const s3Key = pathSegments.map((p) => decodeURIComponent(p)).join("/");

  if (!s3Key.startsWith("docs/") || s3Key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getStreamFromS3(s3Key);
    const headers: HeadersInit = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    };
    if (contentLength != null) {
      headers["Content-Length"] = String(contentLength);
    }
    return new NextResponse(body as BodyInit, { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
