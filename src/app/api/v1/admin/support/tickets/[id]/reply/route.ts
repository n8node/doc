import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { sendEmail } from "@/lib/email-sender";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";

const APP_URL = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "https://qoqon.ru";

/** POST - ответить на тикет от имени админа */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await params;
  const adminUserId = session!.user!.id;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      theme: true,
      user: { select: { id: true, email: true, name: true } },
    },
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
  const replyBody = body.body;
  if (!replyBody || typeof replyBody !== "string" || !replyBody.trim()) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: adminUserId,
        authorRole: "ADMIN",
        body: replyBody.trim(),
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "AWAITING_USER" },
    }),
  ]);

  const ticketUrl = `${APP_URL}/dashboard/support?ticket=${ticketId}`;

  await createNotification({
    userId: ticket.user.id,
    type: "SUPPORT_TICKET",
    category: "info",
    title: "Получен ответ в тикете",
    body: `Тема: ${ticket.theme.name}. Перейдите в раздел поддержки.`,
    payload: { ticketId },
  });

  try {
    await sendEmail({
      to: ticket.user.email,
      subject: `Ответ по тикету: ${ticket.theme.name}`,
      html: `
        <p>Здравствуйте${ticket.user.name ? `, ${ticket.user.name}` : ""}!</p>
        <p>По вашему обращению в техподдержку (тема: ${ticket.theme.name}) получен ответ:</p>
        <div style="background:#f5f5f5;padding:12px;margin:12px 0;border-radius:8px;">${replyBody.trim().replace(/\n/g, "<br>")}</div>
        <p><a href="${ticketUrl}">Открыть тикет</a></p>
        <p>— Служба поддержки qoqon.ru</p>
      `,
      text: `Здравствуйте!\n\nПо вашему обращению (тема: ${ticket.theme.name}) получен ответ:\n\n${replyBody.trim()}\n\nОткрыть тикет: ${ticketUrl}`,
    });
  } catch {
    // ignore email errors
  }

  try {
    await sendUserTelegramNotify(ticket.user.id, "support_reply", {
      themeName: ticket.theme.name,
      ticketUrl,
    });
  } catch {
    // ignore telegram errors
  }

  const updated = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      theme: { select: { name: true, slug: true } },
      user: { select: { email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(updated);
}
