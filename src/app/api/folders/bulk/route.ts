import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { copyFolder, deleteFolderRecursive, moveFolder } from "@/lib/folder-service";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ids, action, parentId } = body;

  if (!Array.isArray(ids) || ids.length === 0 || !action)
    return NextResponse.json(
      { error: "Требуются ids (массив) и action" },
      { status: 400 }
    );

  const errors: string[] = [];
  let ok = 0;

  if (action === "delete") {
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await deleteFolderRecursive(id, session.user.id);
        ok++;
      } catch {
        errors.push(id);
      }
    }
  } else if (action === "move") {
    const targetParentId =
      parentId && typeof parentId === "string" ? parentId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await moveFolder(id, targetParentId, session.user.id);
        ok++;
      } catch {
        errors.push(id);
      }
    }
  } else if (action === "copy") {
    const targetParentId =
      parentId && typeof parentId === "string" ? parentId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await copyFolder(id, targetParentId, session.user.id);
        ok++;
      } catch {
        errors.push(id);
      }
    }
  } else {
    return NextResponse.json(
      { error: "action должен быть delete, move или copy" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok, errors });
}
