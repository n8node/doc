import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.openrouter_api_key";

/**
 * GET — проверить, задан ли ключ OpenRouter для маркетплейса
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = await configStore.get(CONFIG_KEY);
  return NextResponse.json({
    apiKeySet: !!key && key.length > 0,
  });
}

/**
 * POST — сохранить API-ключ OpenRouter для маркетплейса
 * Body: { apiKey?: string } — оставить пустым, чтобы не менять
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (apiKey && apiKey !== "••••••••" && apiKey !== "********") {
    await configStore.set(CONFIG_KEY, apiKey, {
      isEncrypted: true,
      category: "ai",
      description: "OpenRouter API key for LLM marketplace proxy",
    });
    configStore.invalidate(CONFIG_KEY);
  }

  return NextResponse.json({ ok: true });
}
