import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getTrashItems, getTrashSize, getTrashRetentionDays } from "@/lib/trash-service";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, trashSize, retentionDays] = await Promise.all([
    getTrashItems(userId),
    getTrashSize(userId),
    getTrashRetentionDays(userId),
  ]);

  return NextResponse.json({
    files: items.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      folderId: f.folderId,
      mediaMetadata: f.mediaMetadata,
      deletedAt: f.deletedAt,
      createdAt: f.createdAt,
    })),
    folders: items.folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      deletedAt: f.deletedAt,
      createdAt: f.createdAt,
    })),
    trashSize: Number(trashSize),
    retentionDays,
  });
}
