import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { deleteFolderRecursive, moveFolder, renameFolder } from "@/lib/folder-service";
import { softDeleteFolderRecursive, getTrashRetentionDays } from "@/lib/trash-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const folder = await prisma.folder.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, name: true, parentId: true },
  });
  if (!folder)
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  return NextResponse.json(folder);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, parentId } = body;

  try {
    if (name != null && typeof name === "string") {
      const updated = await renameFolder(id, name, userId);
      return NextResponse.json(updated);
    }
    if (parentId !== undefined) {
      const f = await moveFolder(
        id,
        parentId && typeof parentId === "string" ? parentId : null,
        userId
      );
      return NextResponse.json(f);
    }
    return NextResponse.json({ error: "Specify name or parentId" }, { status: 400 });
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
  try {
    const retentionDays = await getTrashRetentionDays(userId);
    if (retentionDays > 0) {
      await softDeleteFolderRecursive(id, userId);
      return NextResponse.json({ ok: true, trashed: true });
    }
    const result = await deleteFolderRecursive(id, userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 404 }
    );
  }
}
