import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import {
  sendDocumentChatMessage,
  getDocumentChatHistory,
} from "@/lib/document-chat-service";
import { hasFeature } from "@/lib/plan-service";
import { resolveFileAccessForUser } from "@/lib/collaborative-share-service";
import { TokenQuotaExceededError } from "@/lib/ai/token-usage";

/**
 * GET /api/files/[id]/chat — load chat history for document
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, fileId);
  if (access.mode === "none") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (access.mode === "shared" && !access.canUseAi) {
    return NextResponse.json(
      { error: "Владелец не разрешил AI-функции для этого доступа." },
      { status: 403 },
    );
  }

  const allowed = await hasFeature(userId, "document_chat");
  if (!allowed) {
    return NextResponse.json(
      { error: "Функция AI чатов по документам недоступна на вашем тарифе. Обновите тариф." },
      { status: 403 },
    );
  }

  const ownerId = access.mode === "owner" ? userId : access.file.userId;
  const messages = await getDocumentChatHistory(fileId, userId, 100, {
    fileOwnerUserId: ownerId,
  });
  if (messages === null) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({ messages });
}

/**
 * POST /api/files/[id]/chat — send message and get assistant reply
 * Body: { content: string }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
  const access = await resolveFileAccessForUser(userId, fileId);
  if (access.mode === "none") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (access.mode === "shared" && !access.canUseAi) {
    return NextResponse.json(
      { error: "Владелец не разрешил AI-функции для этого доступа." },
      { status: 403 },
    );
  }

  const allowed = await hasFeature(userId, "document_chat");
  if (!allowed) {
    return NextResponse.json(
      { error: "Функция AI чатов по документам недоступна на вашем тарифе. Обновите тариф." },
      { status: 403 },
    );
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "content is required and must be non-empty" },
      { status: 400 },
    );
  }

  try {
    const result = await sendDocumentChatMessage({
      fileId,
      userId,
      content,
      fileOwnerUserId: access.mode === "shared" ? access.file.userId : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TokenQuotaExceededError) {
      return NextResponse.json(
        {
          error: "Лимит токенов чата по вашему тарифу исчерпан.",
          code: "CHAT_TOKENS_QUOTA_EXCEEDED",
          quota: e.quota,
          used: e.used,
          requested: e.requested,
        },
        { status: 403 },
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "File not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("не обработан") || msg.includes("AI-провайдер")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[DocumentChat] Error:", e);
    return NextResponse.json(
      { error: "Ошибка при отправке сообщения" },
      { status: 500 },
    );
  }
}
