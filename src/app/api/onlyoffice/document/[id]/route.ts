import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStreamFromS3 } from "@/lib/s3-download";
import { verifyDocumentDownloadJwt } from "@/lib/onlyoffice/download-jwt";
import { tryVerifyOnlyofficeBearerDocument } from "@/lib/onlyoffice/verify-document-request";

function logDocument(label: string, data: Record<string, unknown>) {
  console.info(`[onlyoffice document] ${label}`, data);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token");
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 160);
  const authHdr = req.headers.get("authorization");
  const hasBearer = authHdr?.startsWith("Bearer ") ?? false;

  let payload: { fileId: string; userId: string } | null = null;

  if (token) {
    payload = await verifyDocumentDownloadJwt(token);
  } else {
    payload = await tryVerifyOnlyofficeBearerDocument(req, id);
  }

  if (!payload || payload.fileId !== id) {
    logDocument("deny", {
      id,
      hasToken: !!token,
      hasBearer,
      ua,
      reason: !payload ? "bad_jwt" : "fileId_mismatch",
    });
    return NextResponse.json(
      { error: "Forbidden" },
      { status: token ? 403 : 401 }
    );
  }

  const file = await prisma.file.findFirst({
    where: { id: payload.fileId, userId: payload.userId, deletedAt: null },
  });
  if (!file) {
    logDocument("deny", { id, reason: "file_not_in_db", userId: payload.userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getStreamFromS3(file.s3Key);
    if (body == null) {
      logDocument("error", { id, reason: "s3_empty_body", s3Key: file.s3Key });
      return NextResponse.json({ error: "Storage error" }, { status: 500 });
    }
    logDocument("ok", {
      id,
      name: file.name,
      contentType,
      contentLength,
      hasToken: !!token,
      hasBearer,
      ua,
    });
    const headers: HeadersInit = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
    };
    if (contentLength != null) {
      headers["Content-Length"] = String(contentLength);
    }
    return new NextResponse(body as BodyInit, { headers });
  } catch (e) {
    logDocument("error", {
      id,
      reason: "s3",
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
