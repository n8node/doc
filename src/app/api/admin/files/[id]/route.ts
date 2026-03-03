import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";

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
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file)
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: file.s3Key })
  );
  await prisma.file.delete({ where: { id } });
  await prisma.user.update({
    where: { id: file.userId },
    data: { storageUsed: { decrement: file.size } },
  });
  return NextResponse.json({ ok: true });
}
