import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { emptyTrash } from "@/lib/trash-service";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await emptyTrash(userId);
    return NextResponse.json({
      ok: true,
      deletedFiles: result.deletedFiles,
      freedBytes: Number(result.freedBytes),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка очистки корзины" },
      { status: 500 }
    );
  }
}
