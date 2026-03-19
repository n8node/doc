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
  type LandingDocumentFormats,
  type LandingFeature,
  type LandingStep,
} from "@/lib/landing-content";

const PREFIX = "landing.";
const CATEGORY = "landing";

function isValidBenefit(x: unknown): x is LandingBenefit {
  return typeof x === "object" && x !== null && typeof (x as { text?: unknown }).text === "string";
}

function isValidDocumentFormats(x: unknown): x is LandingDocumentFormats {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { title?: unknown; subtitle?: unknown; iconKeys?: unknown };
  if (typeof o.title !== "string") return false;
  if (o.subtitle !== undefined && typeof o.subtitle !== "string") return false;
  if (!Array.isArray(o.iconKeys)) return false;
  if (o.iconKeys.length > 7) return false;
  return o.iconKeys.every((k) => typeof k === "string");
}

function isValidFeature(x: unknown): x is LandingFeature {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { title?: unknown }).title === "string" &&
    typeof (x as { description?: unknown }).description === "string" &&
    typeof (x as { href?: unknown }).href === "string"
  );
}

function isValidStep(x: unknown): x is LandingStep {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { num?: unknown }).num === "number" &&
    typeof (x as { title?: unknown }).title === "string" &&
    typeof (x as { desc?: unknown }).desc === "string"
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

  const keyToConfig: Record<string, string> = {
    tagline: "tagline",
    heroTitle: "hero_title",
    heroTitleHighlight: "hero_title_highlight",
    heroDescription: "hero_description",
    ctaPrimary: "cta_primary",
    ctaPrimaryHref: "cta_primary_href",
    ctaSecondary: "cta_secondary",
    ctaSecondaryHref: "cta_secondary_href",
    featuresTitle: "features_title",
    stepsTitle: "steps_title",
  };

  for (const [key, configKey] of Object.entries(keyToConfig)) {
    if (typeof body[key] === "string") {
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

  if (body.documentFormats && isValidDocumentFormats(body.documentFormats)) {
    const iconKeys = Array.from({ length: 7 }, (_, i) => {
      const k = body.documentFormats.iconKeys[i];
      return typeof k === "string" && /^doc_format_[0-6]$/.test(k) ? k : "";
    });
    const subtitle =
      typeof body.documentFormats.subtitle === "string" ? body.documentFormats.subtitle : "";
    updates.push(
      configStore.set(
        `${PREFIX}document_formats_json`,
        JSON.stringify({ title: body.documentFormats.title, subtitle, iconKeys }),
        {
          category: CATEGORY,
          description: "Блок Форматы документов",
        }
      )
    );
  }

  if (Array.isArray(body.features)) {
    const features = body.features.filter(isValidFeature);
    updates.push(
      configStore.set(`${PREFIX}features_json`, JSON.stringify(features), {
        category: CATEGORY,
        description: "Блок Возможности",
      })
    );
  }

  if (Array.isArray(body.steps)) {
    const steps = body.steps.filter(isValidStep);
    updates.push(
      configStore.set(`${PREFIX}steps_json`, JSON.stringify(steps), {
        category: CATEGORY,
        description: "Блок Как это работает",
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
    `${PREFIX}hero_title_highlight`,
    `${PREFIX}hero_description`,
    `${PREFIX}cta_primary`,
    `${PREFIX}cta_primary_href`,
    `${PREFIX}cta_secondary`,
    `${PREFIX}cta_secondary_href`,
    `${PREFIX}benefits_json`,
    `${PREFIX}document_formats_json`,
    `${PREFIX}features_title`,
    `${PREFIX}features_json`,
    `${PREFIX}steps_title`,
    `${PREFIX}steps_json`,
  ];
  keysToInvalidate.forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
