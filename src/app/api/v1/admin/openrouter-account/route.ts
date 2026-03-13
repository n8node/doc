import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getOpenRouterActivityManagementKey } from "@/lib/marketplace/openrouter-activity";

const BASE = "https://openrouter.ai/api/v1";

async function fetchWithKey(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * GET — получить все данные аккаунта OpenRouter (credits, keys, activity, current key)
 * Требует настроенный Management API ключ в Настройки → Маркетплейс
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await getOpenRouterActivityManagementKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "KEY_NOT_SET",
        message: "Management API ключ не настроен. Добавьте его в Настройки → Маркетплейс → OpenRouter Activity API.",
      },
      { status: 400 }
    );
  }

  const dateParam = request.nextUrl.searchParams.get("date") ?? undefined;

  const [creditsRes, keysRes, activityRes, keyRes] = await Promise.all([
    fetchWithKey("/credits", apiKey),
    fetchWithKey("/keys?include_disabled=true", apiKey),
    fetchWithKey(
      dateParam ? `/activity?date=${encodeURIComponent(dateParam)}` : "/activity",
      apiKey
    ),
    fetchWithKey("/key", apiKey),
  ]);

  if (!creditsRes.ok && creditsRes.status === 403) {
    return NextResponse.json(
      {
        error: "INVALID_KEY",
        message:
          "Ключ не является Management API key. Создайте его на openrouter.ai/settings/management-keys",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    credits: creditsRes.ok ? creditsRes.data : null,
    keys: keysRes.ok ? keysRes.data : null,
    activity: activityRes.ok ? activityRes.data : null,
    currentKey: keyRes.ok ? keyRes.data : null,
    errors: {
      credits: creditsRes.ok ? null : (creditsRes.data as { error?: { message?: string } })?.error?.message,
      keys: keysRes.ok ? null : (keysRes.data as { error?: { message?: string } })?.error?.message,
      activity: activityRes.ok ? null : (activityRes.data as { error?: { message?: string } })?.error?.message,
      currentKey: keyRes.ok ? null : (keyRes.data as { error?: { message?: string } })?.error?.message,
    },
  });
}
