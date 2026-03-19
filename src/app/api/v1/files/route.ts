import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

const DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/rtf",
];

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const scope = searchParams.get("scope"); // "all" | ""
  const typeFilter = searchParams.get("type"); // image | video | audio | document | all
  const sizeMin = searchParams.get("sizeMin");
  const sizeMax = searchParams.get("sizeMax");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const hasShareLink = searchParams.get("hasShareLink"); // "true" | "false" | ""

  const where: {
    userId: string;
    deletedAt: null;
    folderId?: string | null;
    mimeType?: { startsWith: string } | { in: string[] };
    size?: { gte?: bigint; lte?: bigint };
    createdAt?: { gte?: Date; lte?: Date };
    shareLinks?: { some: { OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }> } };
  } = {
    userId,
    deletedAt: null,
  };

  if (scope !== "all") {
    where.folderId = folderId || null;
  }

  if (typeFilter && typeFilter !== "all") {
    if (typeFilter === "image") where.mimeType = { startsWith: "image/" };
    else if (typeFilter === "video") where.mimeType = { startsWith: "video/" };
    else if (typeFilter === "audio") where.mimeType = { startsWith: "audio/" };
    else if (typeFilter === "document") where.mimeType = { in: DOCUMENT_MIMES };
  }

  if (sizeMin || sizeMax) {
    where.size = {};
    if (sizeMin) where.size.gte = BigInt(sizeMin);
    if (sizeMax) where.size.lte = BigInt(sizeMax);
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  if (hasShareLink === "true") {
    where.shareLinks = {
      some: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };
  }

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      s3Key: true,
      folderId: true,
      mediaMetadata: true,
      aiMetadata: true,
      hasEmbedding: true,
      createdAt: true,
      shareLinks: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      },
      sheetsFromFile: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true },
      },
    },
  });

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      s3Key: f.s3Key,
      folderId: f.folderId,
      mediaMetadata: f.mediaMetadata,
      aiMetadata: f.aiMetadata,
      hasEmbedding: f.hasEmbedding,
      createdAt: f.createdAt,
      hasShareLink: f.shareLinks.length > 0,
      shareLinksCount: f.shareLinks.length,
      importedSheetId: f.sheetsFromFile[0]?.id ?? null,
    })),
  });
}
