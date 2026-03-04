import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { permanentDeleteFile, permanentDeleteFolderFromTrash } from "@/lib/trash-service";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "file";

  try {
    if (type === "folder") {
      await permanentDeleteFolderFromTrash(id, session.user.id);
    } else {
      await permanentDeleteFile(id, session.user.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка удаления" },
      { status: 404 }
    );
  }
}
