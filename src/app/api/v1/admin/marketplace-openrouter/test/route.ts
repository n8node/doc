import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.openrouter_api_key";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

/**
 * POST — проверить соединение с OpenRouter
 * Body: { apiKey?: string } — ключ из формы или сохранённый
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const apiKeyFromBody = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  let apiKey: string;
  if (apiKeyFromBody && apiKeyFromBody !== "••••••••" && apiKeyFromBody !== "********") {
    apiKey = apiKeyFromBody;
  } else {
    const stored = await configStore.get(CONFIG_KEY);
    if (!stored || stored.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Укажите и сохраните API-ключ OpenRouter" },
        { status: 400 }
      );
    }
    apiKey = stored;
  }

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = (data as { error?: { message?: string } })?.error?.message
        ?? (data as { message?: string })?.message
        ?? `HTTP ${res.status}`;
      return NextResponse.json(
        { ok: false, message: String(errMsg) },
        { status: 400 }
      );
    }

    const modelsCount = Array.isArray((data as { data?: unknown[] }).data)
      ? (data as { data: unknown[] }).data.length
      : 0;

    return NextResponse.json({
      ok: true,
      message: "Подключение успешно!",
      modelsCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 400 }
    );
  }
}
