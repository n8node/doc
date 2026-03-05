import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { copyFile, deleteFile, moveFile } from "@/lib/file-service";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ids, action, folderId } = body;

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
        await deleteFile(id, userId);
        ok++;
      } catch (e) {
        console.error(`[files/bulk] delete ${id}:`, e);
        errors.push({ id, message: e instanceof Error ? e.message : "Ошибка" });
      }
    }
  } else if (action === "move") {
    const targetFolderId =
      folderId && typeof folderId === "string" ? folderId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await moveFile(id, targetFolderId, userId);
        ok++;
      } catch (e) {
        console.error(`[files/bulk] move ${id}:`, e);
        errors.push({ id, message: e instanceof Error ? e.message : "Ошибка" });
      }
    }
  } else if (action === "copy") {
    const targetFolderId =
      folderId && typeof folderId === "string" ? folderId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await copyFile(id, targetFolderId, userId);
        ok++;
      } catch (e) {
        console.error(`[files/bulk] copy ${id}:`, e);
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
