import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { emptyTrash } from "@/lib/trash-service";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await emptyTrash(session.user.id);
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
