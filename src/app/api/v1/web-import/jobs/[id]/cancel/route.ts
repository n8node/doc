import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.webImportJob.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  await prisma.webImportJob.update({
    where: { id },
    data: { cancelRequested: true },
  });

  return NextResponse.json({ ok: true });
}
