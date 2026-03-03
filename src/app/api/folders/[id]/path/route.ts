import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const path: { id: string; name: string }[] = [];
  let folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!folder)
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  while (folder) {
    path.unshift({ id: folder.id, name: folder.name });
    if (!folder.parentId) break;
    folder = await prisma.folder.findFirst({
      where: { id: folder.parentId, userId: session.user.id },
    });
  }

  return NextResponse.json({ path });
}
