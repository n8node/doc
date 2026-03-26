import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStreamFromS3 } from "@/lib/s3-download";
import { verifyDocumentDownloadJwt } from "@/lib/onlyoffice/download-jwt";
import { tryVerifyOnlyofficeBearerDocument } from "@/lib/onlyoffice/verify-document-request";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token");

  let payload: { fileId: string; userId: string } | null = null;

  if (token) {
    payload = await verifyDocumentDownloadJwt(token);
  } else {
    payload = await tryVerifyOnlyofficeBearerDocument(req, id);
  }

  if (!payload || payload.fileId !== id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: token ? 403 : 401 }
    );
  }

  const file = await prisma.file.findFirst({
    where: { id: payload.fileId, userId: payload.userId, deletedAt: null },
  });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { body, contentType, contentLength } = await getStreamFromS3(file.s3Key);
  const headers: HeadersInit = {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
  };
  if (contentLength != null) {
    headers["Content-Length"] = String(contentLength);
  }
  return new NextResponse(body as BodyInit, { headers });
}
