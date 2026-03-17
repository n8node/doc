import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getKieApiKey } from "@/lib/generation/kie-api-key";

const KIE_CREDITS_URL = "https://api.kie.ai/api/v1/chat/credit";

/**
 * GET /api/v1/admin/kie/status
 * Проверка подключения к Kie (запрос баланса кредитов).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await getKieApiKey();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message: "API-ключ Kie не задан",
    });
  }

  try {
    const res = await fetch(KIE_CREDITS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json().catch(() => ({}))) as { code?: number; data?: unknown };
    if (data.code === 200) {
      return NextResponse.json({
        ok: true,
        message: "Подключение успешно",
        credits: data.data,
      });
    }
    return NextResponse.json({
      ok: false,
      message: (data as { msg?: string }).msg ?? `Код ${res.status}`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: err instanceof Error ? err.message : "Ошибка запроса",
    });
  }
}
