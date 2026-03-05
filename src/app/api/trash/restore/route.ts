import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { restoreFile, restoreFolderRecursive } from "@/lib/trash-service";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { fileIds, folderIds } = body as {
    fileIds?: string[];
    folderIds?: string[];
  };

  const errors: string[] = [];
  let restoredCount = 0;

  if (Array.isArray(fileIds)) {
    for (const id of fileIds) {
      try {
        await restoreFile(id, userId);
        restoredCount++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `File ${id} error`);
      }
    }
  }

  if (Array.isArray(folderIds)) {
    for (const id of folderIds) {
      try {
        await restoreFolderRecursive(id, userId);
        restoredCount++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Folder ${id} error`);
      }
    }
  }

  return NextResponse.json({ ok: true, restoredCount, errors });
}
