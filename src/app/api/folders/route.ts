import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/folder-service";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const folders = await prisma.folder.findMany({
    where: { userId, parentId: parentId || null, deletedAt: null },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, parentId } = body;
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const folder = await createFolder(
      name,
      parentId && typeof parentId === "string" ? parentId : null,
      userId
    );
    return NextResponse.json(folder);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
