import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.openrouter_management_api_key";
const OPENROUTER_ACTIVITY_URL = "https://openrouter.ai/api/v1/activity";

/**
 * POST — проверить соединение с OpenRouter Activity API
 * Требуется Management API key (openrouter.ai/settings/management-keys)
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
        { ok: false, message: "Укажите и сохраните Management API ключ OpenRouter" },
        { status: 400 }
      );
    }
    apiKey = stored;
  }

  try {
    const res = await fetch(OPENROUTER_ACTIVITY_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: unknown[];
      error?: { message?: string };
      message?: string;
    };

    if (res.status === 403) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "403 Forbidden — нужен именно Management API key. Создайте ключ на openrouter.ai/settings/management-keys",
        },
        { status: 400 }
      );
    }

    if (!res.ok) {
      const errMsg =
        data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      return NextResponse.json(
        { ok: false, message: String(errMsg) },
        { status: 400 }
      );
    }

    const itemsCount = Array.isArray(data?.data) ? data.data.length : 0;

    return NextResponse.json({
      ok: true,
      message: "Подключение к Activity API успешно!",
      itemsCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 400 }
    );
  }
}
