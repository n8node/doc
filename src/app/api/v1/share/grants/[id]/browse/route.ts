import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { browseSharedGrantContents } from "@/lib/collaborative-share-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "No email" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const parentFolderId = searchParams.get("parentFolderId");

  try {
    const data = await browseSharedGrantContents(
      id,
      userId,
      user.email,
      parentFolderId ?? null
    );
    return NextResponse.json({
      grant: {
        id: data.grant.id,
        targetType: data.grant.targetType,
        allowCollections: data.grant.allowCollections,
        allowAiFeatures: data.grant.allowAiFeatures,
      },
      owner: data.owner,
      currentFolderId: data.currentFolderId,
      navUpFolderId: data.navUpFolderId ?? null,
      folders: data.folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        createdAt: f.createdAt.toISOString(),
      })),
      files: data.files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: Number(f.size),
        folderId: f.folderId,
        hasEmbedding: f.hasEmbedding,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: e instanceof Error && e.message.includes("Нет") ? 403 : 400 }
    );
  }
}
