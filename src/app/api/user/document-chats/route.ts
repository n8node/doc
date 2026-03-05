import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan-service";

/**
 * GET /api/user/document-chats — list files that have chat history
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasFeature(session.user.id, "document_chat");
  if (!allowed) {
    return NextResponse.json(
      { error: "Функция AI чатов по документам недоступна на вашем тарифе. Обновите тариф." },
      { status: 403 },
    );
  }

  const files = await prisma.file.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      chatMessages: { some: {} },
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      createdAt: true,
      _count: { select: { chatMessages: true } },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  const items = files.map((f) => {
    const last = f.chatMessages[0];
    return {
      fileId: f.id,
      fileName: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      createdAt: f.createdAt.toISOString(),
      messagesCount: f._count.chatMessages,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
      lastMessagePreview: last ? `${last.role === "user" ? "Вы" : "AI"}: ${last.content.slice(0, 80)}${last.content.length > 80 ? "…" : ""}` : null,
    };
  });

  items.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ items });
}
