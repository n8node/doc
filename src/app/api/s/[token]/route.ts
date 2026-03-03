import { NextRequest, NextResponse } from "next/server";
import { resolveShareLink, markShareLinkUsed } from "@/lib/share-service";
import { prisma } from "@/lib/prisma";

interface FolderTreeNode {
  id: string;
  name: string;
  files: { id: string; name: string; mimeType: string; size: number; mediaMetadata: unknown }[];
  folders: FolderTreeNode[];
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const link = await resolveShareLink(token);
  if (!link)
    return NextResponse.json(
      { error: "Ссылка недействительна или истекла" },
      { status: 404 }
    );

  if (link.oneTime) {
    await markShareLinkUsed(link.id);
  }

  if (link.targetType === "FILE" && link.file) {
    return NextResponse.json({
      type: "FILE",
      file: {
        id: link.file.id,
        name: link.file.name,
        mimeType: link.file.mimeType,
        size: Number(link.file.size),
        mediaMetadata: link.file.mediaMetadata,
      },
    });
  }

  if (link.targetType === "FOLDER" && link.folder) {
    const tree = await buildFolderTree(link.folder.id);
    return NextResponse.json({
      type: "FOLDER",
      folder: { id: link.folder.id, name: link.folder.name },
      tree,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function buildFolderTree(folderId: string): Promise<FolderTreeNode | null> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { files: true },
  });
  if (!folder) return null;

  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    orderBy: { name: "asc" },
  });

  const childTrees = await Promise.all(
    children.map((c) => buildFolderTree(c.id))
  );

  return {
    id: folder.id,
    name: folder.name,
    files: folder.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      mediaMetadata: f.mediaMetadata,
    })),
    folders: childTrees.filter((x): x is FolderTreeNode => x !== null),
  };
}
