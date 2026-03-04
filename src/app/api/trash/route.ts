import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTrashItems, getTrashSize, getTrashRetentionDays } from "@/lib/trash-service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, trashSize, retentionDays] = await Promise.all([
    getTrashItems(session.user.id),
    getTrashSize(session.user.id),
    getTrashRetentionDays(session.user.id),
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
