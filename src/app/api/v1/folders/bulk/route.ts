import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { copyFolder, deleteFolderRecursive, moveFolder } from "@/lib/folder-service";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ids, action, parentId } = body;

  if (!Array.isArray(ids) || ids.length === 0 || !action)
    return NextResponse.json(
      { error: "Требуются ids (массив) и action" },
      { status: 400 }
    );

  const errors: { id: string; message: string }[] = [];
  let ok = 0;

  if (action === "delete") {
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await deleteFolderRecursive(id, userId);
        ok++;
      } catch (e) {
        console.error(`[folders/bulk] delete ${id}:`, e);
        errors.push({ id, message: e instanceof Error ? e.message : "Ошибка" });
      }
    }
  } else if (action === "move") {
    const targetParentId =
      parentId && typeof parentId === "string" ? parentId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await moveFolder(id, targetParentId, userId);
        ok++;
      } catch (e) {
        console.error(`[folders/bulk] move ${id}:`, e);
        errors.push({ id, message: e instanceof Error ? e.message : "Ошибка" });
      }
    }
  } else if (action === "copy") {
    const targetParentId =
      parentId && typeof parentId === "string" ? parentId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await copyFolder(id, targetParentId, userId);
        ok++;
      } catch (e) {
        console.error(`[folders/bulk] copy ${id}:`, e);
        errors.push({ id, message: e instanceof Error ? e.message : "Ошибка" });
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
