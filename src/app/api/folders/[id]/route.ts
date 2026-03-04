import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFolderRecursive, moveFolder, renameFolder } from "@/lib/folder-service";
import { softDeleteFolderRecursive, getTrashRetentionDays } from "@/lib/trash-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, parentId } = body;

  try {
    if (name != null && typeof name === "string") {
      const updated = await renameFolder(id, name, session.user.id);
      return NextResponse.json(updated);
    }
    if (parentId !== undefined) {
      const f = await moveFolder(
        id,
        parentId && typeof parentId === "string" ? parentId : null,
        session.user.id
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
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const retentionDays = await getTrashRetentionDays(session.user.id);
    if (retentionDays > 0) {
      await softDeleteFolderRecursive(id, session.user.id);
      return NextResponse.json({ ok: true, trashed: true });
    }
    const result = await deleteFolderRecursive(id, session.user.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 404 }
    );
  }
}
