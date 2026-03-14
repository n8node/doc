import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/** GET - получить тикет с сообщениями */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId },
    include: {
      theme: { select: { name: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, authorId: true, body: true, createdAt: true },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
