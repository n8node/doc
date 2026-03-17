import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { invalidateKieApiKey } from "@/lib/generation/kie-api-key";

const CONFIG_KEY = "kie.api_key";

/**
 * GET — проверка, задан ли ключ Kie
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
 * POST — сохранить API-ключ Kie.ai
 * Body: { apiKey?: string }
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
      category: "generation",
      description: "Kie.ai API key for image/video generation",
    });
    invalidateKieApiKey();
  }

  return NextResponse.json({ ok: true });
}
