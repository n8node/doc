import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");

  const files = await prisma.file.findMany({
    where: {
      userId: session.user.id,
      folderId: folderId || null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      s3Key: true,
      folderId: true,
      mediaMetadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    files: files.map((f) => ({
      ...f,
      size: Number(f.size),
    })),
  });
}
