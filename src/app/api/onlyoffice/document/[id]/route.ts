import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getStreamFromS3,
  headObjectFromS3,
} from "@/lib/s3-download";
import { verifyDocumentDownloadJwt } from "@/lib/onlyoffice/download-jwt";
import { tryVerifyOnlyofficeBearerDocument } from "@/lib/onlyoffice/verify-document-request";

function logDocument(label: string, data: Record<string, unknown>) {
  console.info(`[onlyoffice document] ${label}`, data);
}

type AuthOk = {
  ok: true;
  file: {
    id: string;
    name: string;
    s3Key: string;
    mimeType: string;
  };
};

type AuthFail = { ok: false; res: NextResponse };

async function authorizeDocumentRequest(
  req: NextRequest,
  id: string
): Promise<AuthOk | AuthFail> {
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
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Forbidden" },
        { status: token ? 403 : 401 }
      ),
    };
  }

  const file = await prisma.file.findFirst({
    where: { id: payload.fileId, userId: payload.userId, deletedAt: null },
    select: { id: true, name: true, s3Key: true, mimeType: true },
  });
  if (!file) {
    logDocument("deny", { id, reason: "file_not_in_db", userId: payload.userId });
    return {
      ok: false,
      res: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true, file };
}

/** Document Server иногда делает HEAD перед GET — без HEAD ответ мог не совпасть с ожиданиями DS. */
export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const auth = await authorizeDocumentRequest(req, id);
  if (!auth.ok) return auth.res;

  try {
    const meta = await headObjectFromS3(auth.file.s3Key);
    const headers: HeadersInit = {
      "Content-Type": meta.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(auth.file.name)}"`,
    };
    if (meta.contentLength != null) {
      headers["Content-Length"] = String(meta.contentLength);
    }
    logDocument("head_ok", {
      id,
      name: auth.file.name,
      contentLength: meta.contentLength,
    });
    return new NextResponse(null, { status: 200, headers });
  } catch (e) {
    logDocument("error", {
      id,
      reason: "s3_head",
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}

function parseBytesRange(
  rangeHeader: string | null,
  totalLength: number
): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const rest = rangeHeader.slice(6);
  const dash = rest.indexOf("-");
  if (dash < 0) return null;
  const startStr = rest.slice(0, dash);
  const endStr = rest.slice(dash + 1);
  const start = parseInt(startStr, 10);
  if (Number.isNaN(start) || start < 0) return null;
  let end: number;
  if (endStr === "") {
    end = totalLength - 1;
  } else {
    end = parseInt(endStr, 10);
    if (Number.isNaN(end) || end < start) return null;
  }
  if (start >= totalLength) return null;
  end = Math.min(end, totalLength - 1);
  return { start, end };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 160);
  const authHdr = req.headers.get("authorization");
  const hasBearer = authHdr?.startsWith("Bearer ") ?? false;
  const token = req.nextUrl.searchParams.get("token");

  const auth = await authorizeDocumentRequest(req, id);
  if (!auth.ok) return auth.res;

  const file = auth.file;

  try {
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const head = await headObjectFromS3(file.s3Key);
      const totalLength = head.contentLength;
      if (totalLength == null) {
        logDocument("error", { id, reason: "s3_no_length_for_range" });
        return NextResponse.json({ error: "Storage error" }, { status: 500 });
      }
      const range = parseBytesRange(rangeHeader, totalLength);
      if (range) {
        const { body, contentType, contentLength } = await getStreamFromS3(
          file.s3Key,
          range
        );
        if (body == null) {
          logDocument("error", { id, reason: "s3_empty_body", s3Key: file.s3Key });
          return NextResponse.json({ error: "Storage error" }, { status: 500 });
        }
        const len = contentLength ?? range.end - range.start + 1;
        logDocument("ok_range", {
          id,
          name: file.name,
          start: range.start,
          end: range.end,
          totalLength,
        });
        return new NextResponse(body as BodyInit, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(len),
            "Content-Range": `bytes ${range.start}-${range.end}/${totalLength}`,
            "Accept-Ranges": "bytes",
            "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
          },
        });
      }
      logDocument("range_ignored", {
        id,
        rangeHeader: rangeHeader.slice(0, 80),
      });
    }

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
      "Accept-Ranges": "bytes",
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
