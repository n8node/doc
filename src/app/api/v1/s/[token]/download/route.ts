import { NextRequest, NextResponse } from "next/server";
import { canAccessFileViaShare } from "@/lib/share-service";
import { getPresignedDownloadUrl } from "@/lib/s3-download";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
  const access = await canAccessFileViaShare(token, fileId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 404 });
  const url = await getPresignedDownloadUrl(access.file.s3Key);
  return NextResponse.json({ url, name: access.file.name });
}
