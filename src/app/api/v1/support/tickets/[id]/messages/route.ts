import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import { configStore } from "@/lib/config-store";

/** POST - добавить сообщение от пользователя */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: ticketId } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: { theme: true, user: { select: { email: true, name: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return NextResponse.json(
      { error: "Ticket is closed" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const messageBody = body.body;
  if (!messageBody || typeof messageBody !== "string" || !messageBody.trim()) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: userId,
        authorRole: "USER",
        body: messageBody.trim(),
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "AWAITING_ADMIN" },
    }),
  ]);

  try {
    const notifyEnabled = await configStore.get("telegram.notify_ticket_enabled");
    if (notifyEnabled === "true") {
      const tg = await getTelegramConfig();
      if (tg.botToken && tg.chatId) {
        const shortId = ticketId.slice(-6);
        const preview = messageBody.trim().slice(0, 300);
        const text = `💬 Ответ в тикете #${shortId}\nТема: ${ticket.theme.name}\nОт: ${ticket.user.email} (${ticket.user.name ?? "—"})\n\n${preview}${messageBody.length > 300 ? "…" : ""}`;
        await sendTelegramMessage(tg.botToken, tg.chatId, text);
      }
    }
  } catch {
    // ignore
  }

  const updated = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      theme: { select: { name: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(updated);
}
