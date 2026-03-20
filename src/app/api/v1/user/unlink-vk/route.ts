import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vkUserId: true, email: true },
  });
  if (!user?.vkUserId) {
    return NextResponse.json({ error: "VK не привязан" }, { status: 400 });
  }

  const placeholder = user.email.endsWith("@qoqon.placeholder");
  if (placeholder) {
    return NextResponse.json(
      { error: "Сначала привяжите email, чтобы можно было отвязать VK" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { vkUserId: null, vkScreenName: null },
  });

  return NextResponse.json({ ok: true });
}
