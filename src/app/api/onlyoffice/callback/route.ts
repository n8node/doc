import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { replaceUserFileContent } from "@/lib/file-service";
import { getOnlyofficeJwtSecret } from "@/lib/onlyoffice/env";
import { parseOnlyofficeDocumentKey } from "@/lib/onlyoffice/mime-editable";
import { resolveOnlyofficeDownloadUrl } from "@/lib/onlyoffice/resolve-url";

export const maxDuration = 120;

async function parseCallbackPayload(
  raw: string,
  bearer: string | null
): Promise<Record<string, unknown> | null> {
  const secret = getOnlyofficeJwtSecret();
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);

  if (bearer?.startsWith("Bearer ")) {
    const t = bearer.slice(7).trim();
    try {
      const { payload } = await jwtVerify(t, key, { algorithms: ["HS256"] });
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("eyJ")) {
    try {
      const { payload } = await jwtVerify(trimmed, key, { algorithms: ["HS256"] });
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const bearer = req.headers.get("authorization");
  const payload = await parseCallbackPayload(raw, bearer);

  if (!payload) {
    return NextResponse.json({ error: 1 });
  }

  const status = Number(payload.status);
  const docKey = typeof payload.key === "string" ? payload.key : null;
  const downloadUrl = typeof payload.url === "string" ? payload.url : null;

  if (status === 4) {
    return NextResponse.json({ error: 0 });
  }

  if (status === 3 || status === 7) {
    console.error("[onlyoffice callback] save error status=", status, payload);
    return NextResponse.json({ error: 0 });
  }

  if (status !== 2 && status !== 6) {
    return NextResponse.json({ error: 0 });
  }

  if (!downloadUrl || !docKey) {
    return NextResponse.json({ error: 0 });
  }

  const parsed = parseOnlyofficeDocumentKey(docKey);
  if (!parsed) {
    console.error("[onlyoffice callback] bad document key", docKey);
    return NextResponse.json({ error: 1 });
  }

  const file = await prisma.file.findFirst({
    where: { id: parsed.fileId, deletedAt: null },
  });
  if (!file) {
    return NextResponse.json({ error: 1 });
  }

  const resolved = resolveOnlyofficeDownloadUrl(downloadUrl);
  let res: Response;
  try {
    res = await fetch(resolved, { redirect: "follow" });
  } catch (e) {
    console.error("[onlyoffice callback] fetch failed", e);
    return NextResponse.json({ error: 1 });
  }

  if (!res.ok) {
    console.error("[onlyoffice callback] bad status", res.status, resolved);
    return NextResponse.json({ error: 1 });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: 1 });
  }

  try {
    await replaceUserFileContent({
      fileId: file.id,
      userId: file.userId,
      buffer: buf,
      mimeType: file.mimeType,
    });
  } catch (e) {
    console.error("[onlyoffice callback] replace failed", e);
    return NextResponse.json({ error: 1 });
  }

  return NextResponse.json({ error: 0 });
}
