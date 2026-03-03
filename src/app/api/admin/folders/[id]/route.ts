import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteFolderRecursive } from "@/lib/folder-service";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder)
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  await deleteFolderRecursive(id, folder.userId);
  return NextResponse.json({ ok: true });
}
