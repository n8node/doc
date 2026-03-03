import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const links = await prisma.shareLink.findMany({
    where: { fileId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    links: links.map((l) => ({
      id: l.id,
      token: l.token,
      targetType: l.targetType,
      expiresAt: l.expiresAt,
      oneTime: l.oneTime,
      usedAt: l.usedAt,
      createdAt: l.createdAt,
    })),
  });
}
