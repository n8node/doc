import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getStreamFromS3 } from "@/lib/s3-download";
import { resolveFileAccessForUser } from "@/lib/collaborative-share-service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, id);
  if (access.mode === "none") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const file = access.file;

  const range = req.headers.get("range");
  let rangeObj: { start: number; end: number } | undefined;
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : Number(file.size) - 1;
      rangeObj = { start, end };
    }
  }

  const { body, contentType, contentLength } = await getStreamFromS3(
    file.s3Key,
    rangeObj
  );

  const headers: HeadersInit = {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
  };
  if (contentLength != null) headers["Content-Length"] = String(contentLength);
  if (rangeObj) {
    const size = Number(file.size);
    headers["Content-Range"] = `bytes ${rangeObj.start}-${rangeObj.end}/${size}`;
    headers["Accept-Ranges"] = "bytes";
    return new NextResponse(body as BodyInit, {
      status: 206,
      headers,
    });
  }

  return new NextResponse(body as BodyInit, { headers });
}
