import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { createShareLink, listShareLinks } from "@/lib/share-service";
import { createShareLinkExpiryNotifications } from "@/lib/notification-service";
import { getPublicBaseUrl } from "@/lib/app-url";

function getShareBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
  if (fromEnv && !fromEnv.includes("localhost")) return fromEnv.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") || request.headers.get("x-forwarded-protocol") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (host) return `${proto === "https" ? "https" : "http"}://${host}`.replace(/\/$/, "");

  return getPublicBaseUrl();
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  const folderId = searchParams.get("folderId");

  const links = await listShareLinks(userId, { fileId, folderId });
  createShareLinkExpiryNotifications(userId, links).catch(() => {});
  return NextResponse.json({
    links: links.map((l) => ({
      id: l.id,
      token: l.token,
      targetType: l.targetType,
      fileId: l.fileId,
      folderId: l.folderId,
      expiresAt: l.expiresAt,
      oneTime: l.oneTime,
      usedAt: l.usedAt,
      file: l.file ? { id: l.file.id, name: l.file.name } : null,
      folder: l.folder ? { id: l.folder.id, name: l.folder.name } : null,
      createdAt: l.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { targetType, fileId, folderId, expiresAt, oneTime } = body;

  if (!targetType || (targetType !== "FILE" && targetType !== "FOLDER"))
    return NextResponse.json({ error: "targetType FILE or FOLDER required" }, { status: 400 });
  if (targetType === "FILE" && !fileId)
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  if (targetType === "FOLDER" && !folderId)
    return NextResponse.json({ error: "folderId required" }, { status: 400 });

  let exp: Date | null = null;
  if (expiresAt) {
    exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime()))
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
  }

  try {
    const link = await createShareLink({
      targetType,
      fileId: targetType === "FILE" ? fileId : null,
      folderId: targetType === "FOLDER" ? folderId : null,
      expiresAt: exp,
      oneTime: !!oneTime,
      userId,
    });
    const baseUrl = getShareBaseUrl(request);
    const url = `${baseUrl}/s/${link.token}`;
    return NextResponse.json({ ...link, url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
