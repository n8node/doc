import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

/**
 * GET /api/admin/ai/chat-prompt — get chat system prompt for RAG
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prompt = await configStore.get("ai.chat_system_prompt");
  return NextResponse.json({
    systemPrompt: prompt ?? "",
  });
}

/**
 * PUT /api/admin/ai/chat-prompt — update chat system prompt
 * Body: { systemPrompt: string }
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";

  await configStore.set("ai.chat_system_prompt", systemPrompt, {
    category: "ai",
    description: "Системный промпт для чата по документу (RAG)",
  });
  configStore.invalidate("ai.chat_system_prompt");

  return NextResponse.json({ ok: true });
}
