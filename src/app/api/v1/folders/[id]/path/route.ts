import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const path: { id: string; name: string }[] = [];
  let folder = await prisma.folder.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!folder)
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  while (folder) {
    path.unshift({ id: folder.id, name: folder.name });
    if (!folder.parentId) break;
    folder = await prisma.folder.findFirst({
      where: { id: folder.parentId, userId, deletedAt: null },
    });
  }

  return NextResponse.json({ path });
}
