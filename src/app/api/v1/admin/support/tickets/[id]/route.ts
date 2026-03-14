import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@prisma/client";

/** GET - получить тикет */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      theme: { select: { name: true, slug: true } },
      user: { select: { email: true, name: true } },
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

/** PATCH - изменить статус тикета */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status } = body;

  const validStatuses: TicketStatus[] = [
    "OPEN",
    "AWAITING_ADMIN",
    "AWAITING_USER",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status },
    include: {
      theme: { select: { name: true, slug: true } },
      user: { select: { email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(ticket);
}
