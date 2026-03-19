import { configStore } from "./config-store";

export type LandingBenefit = {
  text: string;
  color?: "green" | "blue" | "purple" | "default";
};

/** Блок «Форматы документов»: заголовок + до 7 иконок в ряд + текст под блоком */
export type LandingDocumentFormats = {
  title: string;
  /** Строка под иконками (форматы загрузки и т.п.); пусто — не показывать */
  subtitle: string;
  iconKeys: string[]; // doc_format_0, doc_format_1, ... — до 7 иконок
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
  documentFormats: LandingDocumentFormats;
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

const MAX_FORMAT_ICONS = 7;

const DEFAULT_DOCUMENT_FORMATS: LandingDocumentFormats = {
  title: "Форматы документов",
  subtitle: "",
  iconKeys: ["", "", "", "", "", "", ""],
};

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
const DOCUMENT_FORMATS_KEY = `${PREFIX}document_formats_json`;
const FEATURES_KEY = `${PREFIX}features_json`;
const STEPS_KEY = `${PREFIX}steps_json`;
const IMAGE_KEY_SUFFIX = "_key";
const IMAGE_MIME_SUFFIX = "_mime";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function parseDocumentFormats(raw: string | null): LandingDocumentFormats {
  if (!raw || !raw.trim()) return DEFAULT_DOCUMENT_FORMATS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && typeof (parsed as { title?: unknown }).title === "string") {
      const rawKeys = Array.isArray((parsed as { iconKeys?: unknown }).iconKeys)
        ? (parsed as { iconKeys: unknown[] }).iconKeys
        : [];
      const iconKeys = Array.from({ length: MAX_FORMAT_ICONS }, (_, i) => {
        const k = rawKeys[i];
        return typeof k === "string" && /^doc_format_[0-6]$/.test(k) ? k : "";
      });
      const sub = (parsed as { subtitle?: unknown }).subtitle;
      const subtitle = typeof sub === "string" ? sub : "";
      return { title: (parsed as { title: string }).title, subtitle, iconKeys };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_DOCUMENT_FORMATS;
}

export async function getLandingContent(): Promise<LandingContent> {
  try {
    return await getLandingContentInternal();
  } catch (err) {
    console.error("[getLandingContent] error:", err);
    return getLandingContentFallback();
  }
}

async function safeConfigGet(key: string): Promise<string | null> {
  try {
    return await configStore.get(key);
  } catch (err) {
    console.error(`[landing-content] configStore.get("${key}") failed:`, err);
    return null;
  }
}

async function getLandingContentInternal(): Promise<LandingContent> {
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
    documentFormatsRaw,
    featuresTitleRaw,
    featuresRaw,
    stepsTitleRaw,
    stepsRaw,
  ] = await Promise.all([
    safeConfigGet(`${PREFIX}tagline`),
    safeConfigGet(`${PREFIX}hero_title`),
    safeConfigGet(`${PREFIX}hero_title_highlight`),
    safeConfigGet(`${PREFIX}hero_description`),
    safeConfigGet(`${PREFIX}cta_primary`),
    safeConfigGet(`${PREFIX}cta_primary_href`),
    safeConfigGet(`${PREFIX}cta_secondary`),
    safeConfigGet(`${PREFIX}cta_secondary_href`),
    safeConfigGet(BENEFITS_KEY),
    safeConfigGet(DOCUMENT_FORMATS_KEY),
    safeConfigGet(`${PREFIX}features_title`),
    safeConfigGet(FEATURES_KEY),
    safeConfigGet(`${PREFIX}steps_title`),
    safeConfigGet(STEPS_KEY),
  ]);

  const benefits = parseJson<LandingBenefit[]>(benefitsRaw, DEFAULT_BENEFITS);
  const documentFormats = parseDocumentFormats(documentFormatsRaw);
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
    documentFormats,
    featuresTitle: (featuresTitleRaw ?? "").trim() || "Возможности",
    features: Array.isArray(features) ? features : DEFAULT_FEATURES,
    stepsTitle: (stepsTitleRaw ?? "").trim() || "Как это работает",
    steps: Array.isArray(steps) ? steps : DEFAULT_STEPS,
  };
}

function getLandingContentFallback(): LandingContent {
  return {
    tagline: "Облачное хранилище нового поколения",
    heroTitle: "Облачное хранилище + API‑маркетплейс для RAG, поиска и чатов по документам",
    heroTitleHighlight: "API‑маркетплейс",
    heroDescription: "Храните файлы, находите нужное за секунды и общайтесь с документами с помощью искусственного интеллекта.",
    ctaPrimary: "Начать бесплатно",
    ctaPrimaryHref: "/login",
    ctaSecondary: "Смотреть демо",
    ctaSecondaryHref: "/docs",
    benefits: DEFAULT_BENEFITS,
    documentFormats: DEFAULT_DOCUMENT_FORMATS,
    featuresTitle: "Возможности",
    features: DEFAULT_FEATURES,
    stepsTitle: "Как это работает",
    steps: DEFAULT_STEPS,
  };
}

export function getLandingAssetUrl(imageId: string): string {
  return `/api/public/landing-asset/${imageId}`;
}

/** Допустимые imageId: doc_format_N (0..6), feature_N, step_N */
export function isValidLandingImageId(imageId: string): boolean {
  if (typeof imageId !== "string") return false;
  if (/^doc_format_[0-6]$/.test(imageId)) return true;
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
