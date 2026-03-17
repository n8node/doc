import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getYandexMetrikaConfig, YANDEX_METRIKA_CONFIG_KEYS } from "@/lib/yandex-metrika";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getYandexMetrikaConfig();
  return NextResponse.json(config);
}

function toBoolStr(v: unknown): "true" | "false" {
  if (v === true || v === "true" || v === "1") return "true";
  return "false";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Promise<void>[] = [];

  if (body.counterId !== undefined) {
    const value = typeof body.counterId === "string" ? body.counterId.trim() : "";
    updates.push(
      configStore.set("yandex_metrika.counter_id", value, {
        category: "analytics",
        description: "ID счётчика Яндекс.Метрики",
      })
    );
  }

  if (typeof body.webvisor !== "undefined") {
    updates.push(
      configStore.set("yandex_metrika.webvisor", toBoolStr(body.webvisor), {
        category: "analytics",
        description: "Включить Вебвизор",
      })
    );
  }
  if (typeof body.clickmap !== "undefined") {
    updates.push(
      configStore.set("yandex_metrika.clickmap", toBoolStr(body.clickmap), {
        category: "analytics",
        description: "Карта кликов",
      })
    );
  }
  if (typeof body.ecommerce === "string") {
    updates.push(
      configStore.set("yandex_metrika.ecommerce", body.ecommerce.trim(), {
        category: "analytics",
        description: "Имя слоя данных для электронной коммерции",
      })
    );
  }
  if (typeof body.accurateTrackBounce !== "undefined") {
    updates.push(
      configStore.set(
        "yandex_metrika.accurate_track_bounce",
        toBoolStr(body.accurateTrackBounce),
        { category: "analytics", description: "Точный показатель отказов" }
      )
    );
  }
  if (typeof body.trackLinks !== "undefined") {
    updates.push(
      configStore.set("yandex_metrika.track_links", toBoolStr(body.trackLinks), {
        category: "analytics",
        description: "Отслеживание ссылок",
      })
    );
  }

  await Promise.all(updates);

  for (const k of YANDEX_METRIKA_CONFIG_KEYS) {
    configStore.invalidate(k);
  }

  return NextResponse.json({ ok: true });
}
