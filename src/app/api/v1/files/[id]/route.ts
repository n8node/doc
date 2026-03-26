import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { deleteFile, moveFile, renameFile } from "@/lib/file-service";
import { softDeleteFile, getTrashRetentionDays } from "@/lib/trash-service";
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
  const base = {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size),
    folderId: file.folderId,
    mediaMetadata: file.mediaMetadata,
    createdAt: file.createdAt,
  };
  if (access.mode === "shared") {
    return NextResponse.json({
      ...base,
      sharedAccess: true,
      sharedGrantId: access.grant.id,
      sharedFrom: { userId: file.userId },
      allowCollections: access.canUseCollections,
      allowAiFeatures: access.canUseAi,
    });
  }
  return NextResponse.json(base);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, id);
  if (access.mode === "shared") {
    return NextResponse.json(
      { error: "Только просмотр: файл расшарен вам" },
      { status: 403 }
    );
  }
  if (access.mode === "none") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const body = await req.json();
  const { name, folderId } = body;
  try {
    if (name != null && typeof name === "string") {
      const f = await renameFile(id, name, userId);
      return NextResponse.json({ id: f.id, name: f.name, folderId: f.folderId });
    }
    if (folderId !== undefined) {
      const f = await moveFile(
        id,
        folderId && typeof folderId === "string" ? folderId : null,
        userId
      );
      return NextResponse.json({ id: f.id, name: f.name, folderId: f.folderId });
    }
    return NextResponse.json({ error: "Specify name or folderId" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, id);
  if (access.mode === "shared") {
    return NextResponse.json(
      { error: "Только просмотр: файл расшарен вам" },
      { status: 403 }
    );
  }
  if (access.mode === "none") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  try {
    const retentionDays = await getTrashRetentionDays(userId);
    if (retentionDays > 0) {
      await softDeleteFile(id, userId);
      return NextResponse.json({ ok: true, trashed: true });
    }
    await deleteFile(id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 404 }
    );
  }
}
