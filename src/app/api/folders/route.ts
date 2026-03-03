import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/folder-service";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id, parentId: parentId || null },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, parentId } = body;
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const folder = await createFolder(
      name,
      parentId && typeof parentId === "string" ? parentId : null,
      session.user.id
    );
    return NextResponse.json(folder);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
