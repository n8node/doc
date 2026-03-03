import { NextRequest, NextResponse } from "next/server";
import { canAccessFileViaShare } from "@/lib/share-service";
import { getStreamFromS3 } from "@/lib/s3-download";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId)
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  const access = await canAccessFileViaShare(token, fileId);
  if (!access)
    return NextResponse.json({ error: "Access denied" }, { status: 404 });

  const range = req.headers.get("range");
  let rangeObj: { start: number; end: number } | undefined;
  const f = await prisma.file.findUnique({
    where: { id: fileId },
    select: { size: true },
  });
  const fileSize = f ? Number(f.size) : 0;
  if (range && fileSize > 0) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : fileSize - 1;
      rangeObj = { start, end };
    }
  }

  const { body, contentType, contentLength } = await getStreamFromS3(
    access.file.s3Key,
    rangeObj
  );

  const headers: HeadersInit = {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${encodeURIComponent(access.file.name)}"`,
  };
  if (contentLength != null) headers["Content-Length"] = String(contentLength);
  if (rangeObj) {
    headers["Content-Range"] = `bytes ${rangeObj.start}-${rangeObj.end}/${fileSize}`;
    headers["Accept-Ranges"] = "bytes";
    return new NextResponse(body as BodyInit, { status: 206, headers });
  }
  return new NextResponse(body as BodyInit, { headers });
}
