import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getPresignedDownloadUrl } from "@/lib/s3-download";
import { resolveFileAccessForUser } from "@/lib/collaborative-share-service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, id);
  if (access.mode === "none") {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
  const file = access.file;

  const url = await getPresignedDownloadUrl(file.s3Key);
  return NextResponse.json({ url, name: file.name });
}
