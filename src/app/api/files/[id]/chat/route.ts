import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  sendDocumentChatMessage,
  getDocumentChatHistory,
} from "@/lib/document-chat-service";

/**
 * GET /api/files/[id]/chat — load chat history for document
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
  const messages = await getDocumentChatHistory(fileId, session.user.id);
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fileId } = await ctx.params;
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
      userId: session.user.id,
      content,
    });
    return NextResponse.json(result);
  } catch (e) {
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
