import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!file)
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });

  const url = await getPresignedDownloadUrl(file.s3Key);
  return NextResponse.json({ url, name: file.name });
}
