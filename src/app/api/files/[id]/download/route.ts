import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!file)
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });

  const url = await getPresignedDownloadUrl(file.s3Key);
  return NextResponse.json({ url, name: file.name });
}
