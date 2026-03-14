import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import { configStore } from "@/lib/config-store";

/** GET - список тикетов пользователя */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      theme: { select: { name: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(tickets);
}

/** POST - создать тикет */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { themeId, subject, body: messageBody } = body;

  if (!themeId || typeof themeId !== "string") {
    return NextResponse.json(
      { error: "themeId is required" },
      { status: 400 }
    );
  }
  if (!messageBody || typeof messageBody !== "string" || !messageBody.trim()) {
    return NextResponse.json(
      { error: "body (message text) is required" },
      { status: 400 }
    );
  }

  const theme = await prisma.supportTicketTheme.findFirst({
    where: { id: themeId, isActive: true },
  });
  if (!theme) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const [ticket] = await prisma.$transaction([
    prisma.supportTicket.create({
      data: {
        userId,
        themeId: theme.id,
        subject: typeof subject === "string" ? subject.trim() || null : null,
        status: "AWAITING_ADMIN",
      },
    }),
  ]);

  await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: userId,
      authorRole: "USER",
      body: messageBody.trim(),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  try {
    const notifyEnabled = await configStore.get("telegram.notify_ticket_enabled");
    if (notifyEnabled === "true") {
      const tg = await getTelegramConfig();
      if (tg.botToken && tg.chatId) {
        const shortId = ticket.id.slice(-6);
        const preview = messageBody.trim().slice(0, 400);
        const text = `🆕 Новый тикет #${shortId}\nТема: ${theme.name}\nОт: ${user?.email ?? "?"} (${user?.name ?? "—"})\n\n${preview}${messageBody.length > 400 ? "…" : ""}`;
        await sendTelegramMessage(tg.botToken, tg.chatId, text);
      }
    }
  } catch {
    // ignore telegram errors
  }

  const created = await prisma.supportTicket.findUnique({
    where: { id: ticket.id },
    include: {
      theme: { select: { name: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(created);
}
