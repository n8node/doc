import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json(
      { error: "Введите пароль для подтверждения удаления аккаунта" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Неверный пароль" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.shareLink.deleteMany({ where: { createdById: user.id } }),
    prisma.file.deleteMany({ where: { userId: user.id } }),
    prisma.folder.deleteMany({ where: { userId: user.id } }),
    prisma.aiTask.deleteMany({ where: { userId: user.id } }),
    prisma.payment.deleteMany({ where: { userId: user.id } }),
    prisma.historyEvent.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
