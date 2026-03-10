import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getDashboardContent } from "@/lib/dashboard-content";
import {
  DASHBOARD_IMAGE_IDS,
  getDashboardImageConfigKeys,
  type DashboardStep,
  type DashboardCard,
} from "@/lib/dashboard-content";

const PREFIX = "dashboard.";
const CATEGORY = "dashboard";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const content = await getDashboardContent();
  return NextResponse.json(content);
}

function isValidStep(x: unknown): x is DashboardStep {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { title?: unknown }).title === "string" &&
    typeof (x as { description?: unknown }).description === "string"
  );
}

function isValidCard(x: unknown): x is DashboardCard {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { title?: unknown }).title === "string" &&
    typeof (x as { description?: unknown }).description === "string" &&
    typeof (x as { href?: unknown }).href === "string" &&
    typeof (x as { cta?: unknown }).cta === "string"
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Promise<void>[] = [];

  if (typeof body.heroTitle === "string") {
    updates.push(
      configStore.set(`${PREFIX}hero_title`, body.heroTitle.trim(), {
        category: CATEGORY,
        description: "Заголовок героя дашборда",
      })
    );
  }

  if (typeof body.heroSubtitle === "string") {
    updates.push(
      configStore.set(`${PREFIX}hero_subtitle`, body.heroSubtitle.trim(), {
        category: CATEGORY,
        description: "Подзаголовок героя дашборда",
      })
    );
  }

  if (Array.isArray(body.steps)) {
    const steps = body.steps.filter(isValidStep);
    updates.push(
      configStore.set(`${PREFIX}steps_json`, JSON.stringify(steps), {
        category: CATEGORY,
        description: "Шаги «Как это работает»",
      })
    );
  }

  if (Array.isArray(body.cards)) {
    const cards = body.cards.filter(isValidCard);
    updates.push(
      configStore.set(`${PREFIX}cards_json`, JSON.stringify(cards), {
        category: CATEGORY,
        description: "Карточки инструментов",
      })
    );
  }

  if (typeof body.quickUploadLabel === "string") {
    updates.push(
      configStore.set(`${PREFIX}quick_upload_label`, body.quickUploadLabel.trim(), {
        category: CATEGORY,
        description: "Подпись кнопки быстрой загрузки",
      })
    );
  }

  if (typeof body.quickSearchLabel === "string") {
    updates.push(
      configStore.set(`${PREFIX}quick_search_label`, body.quickSearchLabel.trim(), {
        category: CATEGORY,
        description: "Подпись кнопки быстрого поиска",
      })
    );
  }

  if (typeof body.quickChatLabel === "string") {
    updates.push(
      configStore.set(`${PREFIX}quick_chat_label`, body.quickChatLabel.trim(), {
        category: CATEGORY,
        description: "Подпись кнопки быстрого чата",
      })
    );
  }

  if (Array.isArray(body.removeImageIds)) {
    for (const imageId of body.removeImageIds) {
      if (typeof imageId === "string" && DASHBOARD_IMAGE_IDS.includes(imageId as (typeof DASHBOARD_IMAGE_IDS)[number])) {
        const keys = getDashboardImageConfigKeys(imageId);
        if (keys) {
          updates.push(configStore.set(keys.keyKey, "", { category: CATEGORY }));
          updates.push(configStore.set(keys.mimeKey, "", { category: CATEGORY }));
        }
      }
    }
  }

  await Promise.all(updates);

  const keysToInvalidate = [
    `${PREFIX}hero_title`,
    `${PREFIX}hero_subtitle`,
    `${PREFIX}steps_json`,
    `${PREFIX}cards_json`,
    `${PREFIX}quick_upload_label`,
    `${PREFIX}quick_search_label`,
    `${PREFIX}quick_chat_label`,
  ];
  keysToInvalidate.forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
