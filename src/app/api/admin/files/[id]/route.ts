import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Config } from "@/lib/s3-config";
import { createS3Client } from "@/lib/s3";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const { id } = await ctx.params;
  
  try {
    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        folder: { select: { id: true, name: true } },
        shareLinks: {
          select: {
            id: true,
            token: true,
            expiresAt: true,
            oneTime: true,
            usedAt: true,
            createdAt: true,
          }
        },
      }
    });
    
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    return NextResponse.json({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
      s3Key: file.s3Key,
      userId: file.userId,
      user: file.user,
      folderId: file.folderId,
      folder: file.folder,
      hasEmbedding: file.hasEmbedding,
      aiMetadata: file.aiMetadata,
      mediaMetadata: file.mediaMetadata,
      shareLinks: file.shareLinks,
      createdAt: file.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const { id } = await ctx.params;
  const body = await request.json();
  const { name } = body;
  
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  
  try {
    const file = await prisma.file.update({
      where: { id },
      data: { name: name.trim() },
      include: { user: { select: { email: true } } }
    });
    
    return NextResponse.json({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
      userId: file.userId,
      userEmail: file.user?.email,
      folderId: file.folderId,
      createdAt: file.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

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
