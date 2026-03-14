import { configStore } from "./config-store";

export type LandingBenefit = {
  text: string;
  color?: "green" | "blue" | "purple" | "default";
};

export type LandingFileCard = {
  title: string;
  size: string;
  color?: "red" | "blue" | "green" | "default";
  iconKey?: string | null; // file_card_0, file_card_1, ... — PNG иконка вместо цветного квадрата
};

export type LandingFeature = {
  id: string;
  iconKey?: string | null; // feature_0, feature_1, ...
  title: string;
  description: string;
  href: string;
};

export type LandingStep = {
  num: number;
  iconKey?: string | null; // step_0, step_1, ...
  title: string;
  desc: string;
};

export type LandingContent = {
  tagline: string;
  heroTitle: string;
  heroTitleHighlight: string; // слово/фраза для выделения в заголовке; пусто = без выделения
  heroDescription: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  benefits: LandingBenefit[];
  fileCards: LandingFileCard[];
  featuresTitle: string;
  features: LandingFeature[];
  stepsTitle: string;
  steps: LandingStep[];
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

const DEFAULT_FEATURES: LandingFeature[] = [
  { id: "f1", title: "Облачное хранилище", description: "Файлы, папки, версии. Документы, фото, видео в одном месте.", href: "/dashboard/files" },
  { id: "f2", title: "AI-поиск", description: "Семантический поиск по смыслу — находите без точного совпадения слов.", href: "/dashboard/search" },
  { id: "f3", title: "RAG и чаты", description: "Вопросы по документам, RAG-память, векторные коллекции.", href: "/dashboard/document-chats" },
  { id: "f4", title: "API и маркетплейс", description: "REST API, LLM-модели, единый кошелёк, интеграции n8n.", href: "/dashboard/api-docs" },
];

const DEFAULT_STEPS: LandingStep[] = [
  { num: 1, title: "Загрузка", desc: "Загрузите документы в хранилище" },
  { num: 2, title: "Индексация", desc: "Система создаёт поисковые индексы" },
  { num: 3, title: "Поиск и чаты", desc: "Ищите и задавайте вопросы AI по документам" },
];

const PREFIX = "landing.";
const BENEFITS_KEY = `${PREFIX}benefits_json`;
const FILE_CARDS_KEY = `${PREFIX}file_cards_json`;
const FEATURES_KEY = `${PREFIX}features_json`;
const STEPS_KEY = `${PREFIX}steps_json`;
const IMAGE_KEY_SUFFIX = "_key";
const IMAGE_MIME_SUFFIX = "_mime";

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
    heroTitleHighlight,
    heroDescription,
    ctaPrimary,
    ctaPrimaryHref,
    ctaSecondary,
    ctaSecondaryHref,
    benefitsRaw,
    fileCardsRaw,
    featuresTitleRaw,
    featuresRaw,
    stepsTitleRaw,
    stepsRaw,
  ] = await Promise.all([
    configStore.get(`${PREFIX}tagline`),
    configStore.get(`${PREFIX}hero_title`),
    configStore.get(`${PREFIX}hero_title_highlight`),
    configStore.get(`${PREFIX}hero_description`),
    configStore.get(`${PREFIX}cta_primary`),
    configStore.get(`${PREFIX}cta_primary_href`),
    configStore.get(`${PREFIX}cta_secondary`),
    configStore.get(`${PREFIX}cta_secondary_href`),
    configStore.get(BENEFITS_KEY),
    configStore.get(FILE_CARDS_KEY),
    configStore.get(`${PREFIX}features_title`),
    configStore.get(FEATURES_KEY),
    configStore.get(`${PREFIX}steps_title`),
    configStore.get(STEPS_KEY),
  ]);

  const benefits = parseJson<LandingBenefit[]>(benefitsRaw, DEFAULT_BENEFITS);
  const fileCards = parseJson<LandingFileCard[]>(fileCardsRaw, DEFAULT_FILE_CARDS);
  const features = parseJson<LandingFeature[]>(featuresRaw, DEFAULT_FEATURES);
  const steps = parseJson<LandingStep[]>(stepsRaw, DEFAULT_STEPS);

  return {
    tagline: (tagline ?? "").trim() || "Облачное хранилище нового поколения",
    heroTitle: (heroTitle ?? "").trim() || "Облачное хранилище + API‑маркетплейс для RAG, поиска и чатов по документам",
    heroTitleHighlight: (heroTitleHighlight ?? "").trim() || "API‑маркетплейс",
    heroDescription: (heroDescription ?? "").trim() || "Храните файлы, находите нужное за секунды и общайтесь с документами с помощью искусственного интеллекта. Семантический поиск, RAG-память и API для интеграций.",
    ctaPrimary: (ctaPrimary ?? "").trim() || "Начать бесплатно",
    ctaPrimaryHref: (ctaPrimaryHref ?? "").trim() || "/login",
    ctaSecondary: (ctaSecondary ?? "").trim() || "Смотреть демо",
    ctaSecondaryHref: (ctaSecondaryHref ?? "").trim() || "/docs",
    benefits: Array.isArray(benefits) ? benefits : DEFAULT_BENEFITS,
    fileCards: Array.isArray(fileCards) ? fileCards : DEFAULT_FILE_CARDS,
    featuresTitle: (featuresTitleRaw ?? "").trim() || "Возможности",
    features: Array.isArray(features) ? features : DEFAULT_FEATURES,
    stepsTitle: (stepsTitleRaw ?? "").trim() || "Как это работает",
    steps: Array.isArray(steps) ? steps : DEFAULT_STEPS,
  };
}

export function getLandingAssetUrl(imageId: string): string {
  return `/api/public/landing-asset/${imageId}`;
}

/** Допустимые imageId: file_card_N, feature_N, step_N */
export function isValidLandingImageId(imageId: string): boolean {
  if (typeof imageId !== "string") return false;
  if (/^file_card_\d+$/.test(imageId)) return true;
  if (/^feature_\d+$/.test(imageId)) return true;
  if (/^step_\d+$/.test(imageId)) return true;
  return false;
}

export function getLandingImageConfigKeys(imageId: string): { keyKey: string; mimeKey: string } | null {
  if (!isValidLandingImageId(imageId)) return null;
  return {
    keyKey: `${PREFIX}image_${imageId}${IMAGE_KEY_SUFFIX}`,
    mimeKey: `${PREFIX}image_${imageId}${IMAGE_MIME_SUFFIX}`,
  };
}
