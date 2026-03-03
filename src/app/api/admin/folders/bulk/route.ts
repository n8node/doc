import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteFolderRecursive } from "@/lib/folder-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids required" }, { status: 400 });

  for (const id of ids) {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (folder) {
      await deleteFolderRecursive(id, folder.userId);
    }
  }
  return NextResponse.json({ ok: true });
}
