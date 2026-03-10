import { configStore } from "./config-store";

export type DashboardStep = {
  title: string;
  description: string;
};

export type DashboardCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  imageKey?: string | null; // config key suffix: card_files, card_search, etc.
};

export type DashboardContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroImageKey: string | null;
  steps: DashboardStep[];
  cards: DashboardCard[];
  quickUploadLabel: string;
  quickSearchLabel: string;
  quickChatLabel: string;
};

const DEFAULT_STEPS: DashboardStep[] = [
  { title: "Загрузка", description: "Загрузите документы, фото и видео в хранилище" },
  { title: "Индексация", description: "Система автоматически создаёт поисковые индексы" },
  { title: "Поиск и чаты", description: "Ищите по смыслу и задавайте вопросы AI по документам" },
];

const DEFAULT_CARDS: DashboardCard[] = [
  { id: "files", title: "Файлы", description: "Загружайте документы, фото, видео в ваше личное хранилище", href: "/dashboard/files", cta: "Мои файлы", imageKey: "card_files" },
  { id: "search", title: "Поиск", description: "Семантический поиск по смыслу — находите нужное без точного совпадения слов", href: "/dashboard/search", cta: "Искать", imageKey: "card_search" },
  { id: "chat", title: "AI-чаты", description: "Задавайте вопросы по своим документам — AI отвечает на основе содержимого", href: "/dashboard/document-chats", cta: "Открыть чаты", imageKey: "card_chat" },
  { id: "rag", title: "RAG-память", description: "Настройте, как система запоминает и использует ваши файлы для AI", href: "/dashboard/rag-memory", cta: "Настроить", imageKey: "card_rag" },
  { id: "embeddings", title: "Векторная база", description: "Просмотр эмбеддингов и индексов для семантического поиска", href: "/dashboard/embeddings", cta: "Просмотреть", imageKey: "card_embeddings" },
  { id: "api", title: "API", description: "Подключайте внешние системы и автоматизируйте через REST API", href: "/dashboard/api-docs", cta: "API настройки", imageKey: "card_api" },
];

const PREFIX = "dashboard.";
const STEPS_KEY = `${PREFIX}steps_json`;
const CARDS_KEY = `${PREFIX}cards_json`;
const IMAGE_KEY_SUFFIX = "_key";
const IMAGE_MIME_SUFFIX = "_mime";

export const DASHBOARD_IMAGE_IDS = ["hero", "card_files", "card_search", "card_chat", "card_rag", "card_embeddings", "card_api"] as const;
export type DashboardImageId = (typeof DASHBOARD_IMAGE_IDS)[number];

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function getDashboardContent(): Promise<DashboardContent> {
  const [
    heroTitle,
    heroSubtitle,
    heroImageKeyRaw,
    stepsRaw,
    cardsRaw,
    quickUploadLabel,
    quickSearchLabel,
    quickChatLabel,
  ] = await Promise.all([
    configStore.get(`${PREFIX}hero_title`),
    configStore.get(`${PREFIX}hero_subtitle`),
    configStore.get(`${PREFIX}image_hero_key`),
    configStore.get(STEPS_KEY),
    configStore.get(CARDS_KEY),
    configStore.get(`${PREFIX}quick_upload_label`),
    configStore.get(`${PREFIX}quick_search_label`),
    configStore.get(`${PREFIX}quick_chat_label`),
  ]);

  const steps = parseJson<DashboardStep[]>(stepsRaw, DEFAULT_STEPS);
  const cards = parseJson<DashboardCard[]>(cardsRaw, DEFAULT_CARDS);

  return {
    heroTitle: (heroTitle ?? "").trim() || "Добро пожаловать",
    heroSubtitle: (heroSubtitle ?? "").trim() || "Облачное хранилище с AI-поиском и чатами по документам",
    heroImageKey: heroImageKeyRaw && heroImageKeyRaw.trim() ? heroImageKeyRaw.trim() : null,
    steps: Array.isArray(steps) ? steps : DEFAULT_STEPS,
    cards: Array.isArray(cards) ? cards : DEFAULT_CARDS,
    quickUploadLabel: (quickUploadLabel ?? "").trim() || "Загрузить",
    quickSearchLabel: (quickSearchLabel ?? "").trim() || "Поиск",
    quickChatLabel: (quickChatLabel ?? "").trim() || "Новый чат",
  };
}

export function getDashboardAssetUrl(imageId: string): string {
  return `/api/public/dashboard-asset/${imageId}`;
}

export function getDashboardImageConfigKeys(imageId: string): { keyKey: string; mimeKey: string } | null {
  if (!DASHBOARD_IMAGE_IDS.includes(imageId as DashboardImageId)) return null;
  return {
    keyKey: `${PREFIX}image_${imageId}${IMAGE_KEY_SUFFIX}`,
    mimeKey: `${PREFIX}image_${imageId}${IMAGE_MIME_SUFFIX}`,
  };
}
