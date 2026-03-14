import { configStore } from "./config-store";

export type LandingBenefit = {
  text: string;
  color?: "green" | "blue" | "purple" | "default";
};

export type LandingFileCard = {
  title: string;
  size: string;
  color?: "red" | "blue" | "green" | "default";
};

export type LandingContent = {
  tagline: string;
  heroTitle: string;
  heroDescription: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  benefits: LandingBenefit[];
  fileCards: LandingFileCard[];
  heroImageKey: string | null;
};

const DEFAULT_BENEFITS: LandingBenefit[] = [
  { text: "99.9% Uptime", color: "green" },
  { text: "Шифрование данных", color: "blue" },
  { text: "GDPR совместимость", color: "purple" },
  { text: "API-маркетплейс LLM", color: "default" },
];

const DEFAULT_FILE_CARDS: LandingFileCard[] = [
  { title: "Презентация Q1.pdf", size: "2.4 MB", color: "red" },
  { title: "Договор_2024.docx", size: "156 KB", color: "blue" },
  { title: "Отчёт_март.xlsx", size: "890 KB", color: "green" },
];

const PREFIX = "landing.";
const BENEFITS_KEY = `${PREFIX}benefits_json`;
const FILE_CARDS_KEY = `${PREFIX}file_cards_json`;
const IMAGE_KEY_SUFFIX = "_key";
const IMAGE_MIME_SUFFIX = "_mime";

export const LANDING_IMAGE_IDS = ["hero"] as const;
export type LandingImageId = (typeof LANDING_IMAGE_IDS)[number];

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function getLandingContent(): Promise<LandingContent> {
  const [
    tagline,
    heroTitle,
    heroDescription,
    ctaPrimary,
    ctaPrimaryHref,
    ctaSecondary,
    ctaSecondaryHref,
    benefitsRaw,
    fileCardsRaw,
    heroImageKeyRaw,
  ] = await Promise.all([
    configStore.get(`${PREFIX}tagline`),
    configStore.get(`${PREFIX}hero_title`),
    configStore.get(`${PREFIX}hero_description`),
    configStore.get(`${PREFIX}cta_primary`),
    configStore.get(`${PREFIX}cta_primary_href`),
    configStore.get(`${PREFIX}cta_secondary`),
    configStore.get(`${PREFIX}cta_secondary_href`),
    configStore.get(BENEFITS_KEY),
    configStore.get(FILE_CARDS_KEY),
    configStore.get(`${PREFIX}image_hero_key`),
  ]);

  const benefits = parseJson<LandingBenefit[]>(benefitsRaw, DEFAULT_BENEFITS);
  const fileCards = parseJson<LandingFileCard[]>(fileCardsRaw, DEFAULT_FILE_CARDS);

  return {
    tagline: (tagline ?? "").trim() || "Облачное хранилище нового поколения",
    heroTitle: (heroTitle ?? "").trim() || "Облачное хранилище + API‑маркетплейс для RAG, поиска и чатов по документам",
    heroDescription: (heroDescription ?? "").trim() || "Храните файлы, находите нужное за секунды и общайтесь с документами с помощью искусственного интеллекта. Семантический поиск, RAG-память и API для интеграций.",
    ctaPrimary: (ctaPrimary ?? "").trim() || "Начать бесплатно",
    ctaPrimaryHref: (ctaPrimaryHref ?? "").trim() || "/login",
    ctaSecondary: (ctaSecondary ?? "").trim() || "Смотреть демо",
    ctaSecondaryHref: (ctaSecondaryHref ?? "").trim() || "/docs",
    benefits: Array.isArray(benefits) ? benefits : DEFAULT_BENEFITS,
    fileCards: Array.isArray(fileCards) ? fileCards : DEFAULT_FILE_CARDS,
    heroImageKey: heroImageKeyRaw && heroImageKeyRaw.trim() ? heroImageKeyRaw.trim() : null,
  };
}

export function getLandingAssetUrl(imageId: string): string {
  return `/api/public/landing-asset/${imageId}`;
}

export function isValidLandingImageId(imageId: string): boolean {
  return imageId === "hero";
}

export function getLandingImageConfigKeys(imageId: string): { keyKey: string; mimeKey: string } | null {
  if (!isValidLandingImageId(imageId)) return null;
  return {
    keyKey: `${PREFIX}image_${imageId}${IMAGE_KEY_SUFFIX}`,
    mimeKey: `${PREFIX}image_${imageId}${IMAGE_MIME_SUFFIX}`,
  };
}
