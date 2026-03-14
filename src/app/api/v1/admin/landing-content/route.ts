import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getLandingContent } from "@/lib/landing-content";
import {
  isValidLandingImageId,
  getLandingImageConfigKeys,
  type LandingBenefit,
  type LandingFileCard,
} from "@/lib/landing-content";

const PREFIX = "landing.";
const CATEGORY = "landing";

function isValidBenefit(x: unknown): x is LandingBenefit {
  return typeof x === "object" && x !== null && typeof (x as { text?: unknown }).text === "string";
}

function isValidFileCard(x: unknown): x is LandingFileCard {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { title?: unknown }).title === "string" &&
    typeof (x as { size?: unknown }).size === "string"
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const content = await getLandingContent();
  return NextResponse.json(content);
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

  const strKeys = [
    "tagline",
    "heroTitle",
    "heroDescription",
    "ctaPrimary",
    "ctaPrimaryHref",
    "ctaSecondary",
    "ctaSecondaryHref",
  ] as const;

  const keyToConfig: Record<string, string> = {
    tagline: "tagline",
    heroTitle: "hero_title",
    heroDescription: "hero_description",
    ctaPrimary: "cta_primary",
    ctaPrimaryHref: "cta_primary_href",
    ctaSecondary: "cta_secondary",
    ctaSecondaryHref: "cta_secondary_href",
  };
  for (const key of strKeys) {
    const configKey = keyToConfig[key];
    if (configKey && typeof body[key] === "string") {
      updates.push(
        configStore.set(`${PREFIX}${configKey}`, body[key].trim(), {
          category: CATEGORY,
          description: key,
        })
      );
    }
  }

  if (Array.isArray(body.benefits)) {
    const benefits = body.benefits.filter(isValidBenefit);
    updates.push(
      configStore.set(`${PREFIX}benefits_json`, JSON.stringify(benefits), {
        category: CATEGORY,
        description: "Преимущества под CTA",
      })
    );
  }

  if (Array.isArray(body.fileCards)) {
    const fileCards = body.fileCards.filter(isValidFileCard);
    updates.push(
      configStore.set(`${PREFIX}file_cards_json`, JSON.stringify(fileCards), {
        category: CATEGORY,
        description: "Карточки примеров файлов",
      })
    );
  }

  if (Array.isArray(body.removeImageIds)) {
    for (const imageId of body.removeImageIds) {
      if (typeof imageId === "string" && isValidLandingImageId(imageId)) {
        const keys = getLandingImageConfigKeys(imageId);
        if (keys) {
          updates.push(configStore.set(keys.keyKey, "", { category: CATEGORY }));
          updates.push(configStore.set(keys.mimeKey, "", { category: CATEGORY }));
        }
      }
    }
  }

  await Promise.all(updates);

  const keysToInvalidate = [
    `${PREFIX}tagline`,
    `${PREFIX}hero_title`,
    `${PREFIX}hero_description`,
    `${PREFIX}cta_primary`,
    `${PREFIX}cta_primary_href`,
    `${PREFIX}cta_secondary`,
    `${PREFIX}cta_secondary_href`,
    `${PREFIX}benefits_json`,
    `${PREFIX}file_cards_json`,
    `${PREFIX}image_hero_key`,
    `${PREFIX}image_hero_mime`,
  ];
  keysToInvalidate.forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
