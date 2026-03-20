import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processWebImportStep } from "@/lib/web-import/process-job";

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

  if (
    job.status === "completed" ||
    job.status === "cancelled" ||
    job.status === "failed"
  ) {
    const j = await prisma.webImportJob.findFirst({ where: { id } });
    return NextResponse.json({
      id: j!.id,
      mode: j!.mode,
      status: j!.status,
      pages: j!.pages,
      errorMessage: j!.errorMessage,
    });
  }

  await processWebImportStep(id);

  const updated = await prisma.webImportJob.findFirst({ where: { id } });
  if (!updated) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    mode: updated.mode,
    status: updated.status,
    cancelRequested: updated.cancelRequested,
    pages: updated.pages,
    errorMessage: updated.errorMessage,
  });
}
