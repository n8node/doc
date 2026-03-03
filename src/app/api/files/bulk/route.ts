import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteFile, moveFile } from "@/lib/file-service";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ids, action, folderId } = body;

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
        await deleteFile(id, session.user.id);
        ok++;
      } catch {
        errors.push(id);
      }
    }
  } else if (action === "move") {
    const targetFolderId =
      folderId && typeof folderId === "string" ? folderId : null;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      try {
        await moveFile(id, targetFolderId, session.user.id);
        ok++;
      } catch {
        errors.push(id);
      }
    }
  } else {
    return NextResponse.json(
      { error: "action должен быть delete или move" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok, errors });
}
