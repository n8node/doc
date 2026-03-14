import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@prisma/client";

const VALID_STATUSES: TicketStatus[] = [
  "OPEN",
  "AWAITING_ADMIN",
  "AWAITING_USER",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

/** GET - список всех тикетов */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const themeId = searchParams.get("themeId");

  const where: { status?: TicketStatus; themeId?: string } = {};
  if (statusParam && VALID_STATUSES.includes(statusParam as TicketStatus)) {
    where.status = statusParam as TicketStatus;
  }
  if (themeId) where.themeId = themeId;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      theme: { select: { name: true, slug: true } },
      user: { select: { email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(tickets);
}
