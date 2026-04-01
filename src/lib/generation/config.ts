import { configStore } from "@/lib/config-store";
import {
  DEFAULT_VIDEO_PRICING_FORMULA,
  normalizeVideoPricingFormula,
  type VideoPricingFormulaConfig,
} from "@/lib/generation/video-pricing-formula";

const KEYS = {
  imageEnabled: "generation.image_enabled",
  imageTasks: "generation.image_tasks",
  imageModels: "generation.image_models",
  videoEnabled: "generation.video_enabled",
  videoTasks: "generation.video_tasks",
  videoModels: "generation.video_models",
  videoPricingFormula: "generation.video_pricing_formula",
  marginPercent: "generation.margin_percent",
  kopecksPerCredit: "generation.kopecks_per_credit",
} as const;

export type { VideoPricingFormulaConfig };

const DEFAULT_MARGIN = 0;
const MIN_MARGIN = 0;
const MAX_MARGIN = 95;

export interface ImageTaskConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface ImageModelConfig {
  id: string;
  /** Системное название (Kie / API). */
  name: string;
  /** Публичное название для интерфейса (если задано — показывается вместо name). */
  displayName?: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

export interface VideoTaskConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface VideoModelConfig {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

const DEFAULT_TASKS: ImageTaskConfig[] = [
  { id: "text_to_image", label: "Text to image", enabled: true, order: 1 },
  { id: "edit_image", label: "Edit image", enabled: true, order: 2 },
  { id: "variations", label: "Image to image", enabled: true, order: 3 },
];

const DEFAULT_MODELS: ImageModelConfig[] = [
  { id: "kie-4o-image", name: "4o Image", description: "Фотореализм, работа с текстом", enabled: true, taskIds: ["text_to_image", "edit_image", "variations"], order: 1 },
  { id: "kie-flux-kontext", name: "Flux Kontext", description: "Стилизованные сцены", enabled: true, taskIds: ["text_to_image", "edit_image"], order: 2 },
  { id: "kie-nano-banana-pro", name: "Nano Banana Pro", description: "Google Pro Image to Image", enabled: true, taskIds: ["edit_image"], order: 3 },
  { id: "kie-nano-banana-2", name: "Nano Banana 2", description: "Google, текст или изображения", enabled: true, taskIds: ["text_to_image", "edit_image"], order: 4 },
  { id: "kie-nano-banana", name: "Nano Banana", description: "Google текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 5 },
  { id: "kie-nano-banana-edit", name: "Nano Banana Edit", description: "Google редактирование по промпту", enabled: true, taskIds: ["edit_image"], order: 6 },
  { id: "kie-qwen-text-to-image", name: "Qwen Text to Image", description: "Qwen текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 7 },
  { id: "kie-qwen-image-to-image", name: "Qwen Image to Image", description: "Qwen изображение → изображение", enabled: true, taskIds: ["edit_image"], order: 8 },
  { id: "kie-gpt-image-15-text", name: "GPT Image 1.5 Text", description: "GPT Image 1.5 текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 9 },
  { id: "kie-gpt-image-15-image", name: "GPT Image 1.5 Image", description: "GPT Image 1.5 редактирование", enabled: true, taskIds: ["edit_image"], order: 10 },
  { id: "kie-flux2-pro-text", name: "Flux-2 Pro Text", description: "Flux-2 Pro текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 11 },
  { id: "kie-flux2-pro-image", name: "Flux-2 Pro Image", description: "Flux-2 Pro изображение → изображение", enabled: true, taskIds: ["edit_image"], order: 12 },
  { id: "kie-flux2-flex-text", name: "Flux-2 Flex Text", description: "Flux-2 Flex текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 13 },
  { id: "kie-flux2-flex-image", name: "Flux-2 Flex Image", description: "Flux-2 Flex изображение → изображение", enabled: true, taskIds: ["edit_image"], order: 14 },
  { id: "kie-qwen-image-edit", name: "Qwen Image Edit", description: "Qwen редактирование (image_size, num_images)", enabled: true, taskIds: ["edit_image"], order: 15 },
  { id: "kie-qwen2-text-to-image", name: "Qwen 2 Text to Image", description: "Qwen Image 2.0 текст → изображение", enabled: true, taskIds: ["text_to_image"], order: 16 },
  { id: "kie-qwen2-image-edit", name: "Qwen 2 Image Edit", description: "Qwen Image 2.0 редактирование (до 3 фото)", enabled: true, taskIds: ["edit_image"], order: 17 },
];

const DEFAULT_VIDEO_TASKS: VideoTaskConfig[] = [
  { id: "kling30_video", label: "Kling 3.0 — сюжет и кадры", enabled: true, order: 1 },
  { id: "kling30_motion", label: "Kling 3.0 — перенос движения", enabled: true, order: 2 },
];

const DEFAULT_VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "kie-kling-30-video",
    name: "Kling 3.0 Video",
    description: "Текст / старт-финиш кадр, звук, 3–15 с (std/pro)",
    enabled: true,
    taskIds: ["kling30_video"],
    order: 1,
  },
  {
    id: "kie-kling-30-motion",
    name: "Kling 3.0 Motion Control",
    description: "Изображение + референс-видео движения (720p/1080p)",
    enabled: true,
    taskIds: ["kling30_motion"],
    order: 2,
  },
];

export async function getImageGenerationEnabled(): Promise<boolean> {
  const v = await configStore.get(KEYS.imageEnabled);
  return v === "true" || v === "1";
}

export async function setImageGenerationEnabled(enabled: boolean): Promise<void> {
  await configStore.set(KEYS.imageEnabled, enabled ? "true" : "false", {
    category: "generation",
    description: "Включить раздел генерации изображений для пользователей",
  });
}

export async function getImageTasksConfig(): Promise<ImageTaskConfig[]> {
  const v = await configStore.get(KEYS.imageTasks);
  if (!v || v.trim() === "") return DEFAULT_TASKS;
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ImageTaskConfig[];
  } catch {
    // ignore
  }
  return DEFAULT_TASKS;
}

export async function setImageTasksConfig(tasks: ImageTaskConfig[]): Promise<void> {
  await configStore.set(KEYS.imageTasks, JSON.stringify(tasks), {
    category: "generation",
    description: "Список задач генерации изображений (id, label, enabled, order)",
  });
}

export async function getImageModelsConfig(): Promise<ImageModelConfig[]> {
  const v = await configStore.get(KEYS.imageModels);
  if (!v || v.trim() === "") return DEFAULT_MODELS;
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ImageModelConfig[];
  } catch {
    // ignore
  }
  return DEFAULT_MODELS;
}

export async function setImageModelsConfig(models: ImageModelConfig[]): Promise<void> {
  await configStore.set(KEYS.imageModels, JSON.stringify(models), {
    category: "generation",
    description: "Список моделей генерации изображений",
  });
}

export async function getVideoGenerationEnabled(): Promise<boolean> {
  const v = await configStore.get(KEYS.videoEnabled);
  return v === "true" || v === "1";
}

export async function setVideoGenerationEnabled(enabled: boolean): Promise<void> {
  await configStore.set(KEYS.videoEnabled, enabled ? "true" : "false", {
    category: "generation",
    description: "Включить раздел генерации видео для пользователей",
  });
}

export async function getVideoTasksConfig(): Promise<VideoTaskConfig[]> {
  const v = await configStore.get(KEYS.videoTasks);
  if (!v || v.trim() === "") return DEFAULT_VIDEO_TASKS;
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as VideoTaskConfig[];
  } catch {
    // ignore
  }
  return DEFAULT_VIDEO_TASKS;
}

export async function setVideoTasksConfig(tasks: VideoTaskConfig[]): Promise<void> {
  await configStore.set(KEYS.videoTasks, JSON.stringify(tasks), {
    category: "generation",
    description: "Задачи генерации видео",
  });
}

export async function getVideoModelsConfig(): Promise<VideoModelConfig[]> {
  const v = await configStore.get(KEYS.videoModels);
  if (!v || v.trim() === "") return DEFAULT_VIDEO_MODELS;
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as VideoModelConfig[];
  } catch {
    // ignore
  }
  return DEFAULT_VIDEO_MODELS;
}

export async function setVideoModelsConfig(models: VideoModelConfig[]): Promise<void> {
  await configStore.set(KEYS.videoModels, JSON.stringify(models), {
    category: "generation",
    description: "Модели генерации видео",
  });
}

/** Формула цен Kling (видео): базы, коэффициенты, доп. кредиты на модель. */
export async function getVideoPricingFormula(): Promise<VideoPricingFormulaConfig> {
  const v = await configStore.get(KEYS.videoPricingFormula);
  if (!v || v.trim() === "") return structuredClone(DEFAULT_VIDEO_PRICING_FORMULA);
  try {
    const parsed = JSON.parse(v) as unknown;
    return normalizeVideoPricingFormula(parsed);
  } catch {
    return structuredClone(DEFAULT_VIDEO_PRICING_FORMULA);
  }
}

export async function setVideoPricingFormula(formula: VideoPricingFormulaConfig): Promise<void> {
  const normalized = normalizeVideoPricingFormula(formula);
  await configStore.set(KEYS.videoPricingFormula, JSON.stringify(normalized), {
    category: "generation",
    description: "Формула цен генерации видео Kling (база, сек, звук, motion, доп. на модель)",
  });
}

/**
 * Сбросить задачи и модели к умолчанию (пустой список в БД → при чтении вернутся DEFAULT_TASKS и DEFAULT_MODELS).
 */
export async function resetImageGenerationTasksAndModels(): Promise<void> {
  await setImageTasksConfig([]);
  await setImageModelsConfig([]);
}

export async function resetVideoGenerationTasksAndModels(): Promise<void> {
  await setVideoTasksConfig([]);
  await setVideoModelsConfig([]);
}

/**
 * Наценка на кредиты при генерации изображений/видео (отдельно от маркетплейса LLM).
 * 0–95%. По умолчанию 0.
 */
export async function getGenerationMarginPercent(): Promise<number> {
  const v = await configStore.get(KEYS.marginPercent);
  if (v == null || v === "") return DEFAULT_MARGIN;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < MIN_MARGIN) return DEFAULT_MARGIN;
  if (n > MAX_MARGIN) return MAX_MARGIN;
  return n;
}

export async function setGenerationMarginPercent(percent: number): Promise<void> {
  const value = Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, Math.round(percent)));
  await configStore.set(KEYS.marginPercent, String(value), {
    category: "generation",
    description: "Наценка % на кредиты при генерации изображений и видео",
  });
}

/**
 * Применить наценку к количеству кредитов (наценка на себестоимость).
 * marginPercent 90 → billedCredits = rawCredits * (100 + 90) / 100 = 1.9× (12 → 23).
 */
export function applyGenerationMargin(rawCredits: number, marginPercent: number): number {
  if (marginPercent <= 0) return rawCredits;
  return Math.max(rawCredits, Math.round((rawCredits * (100 + marginPercent)) / 100));
}

const DEFAULT_KOPECKS_PER_CREDIT = 10;

/** Курс: копеек за 1 кредит генерации (для списания с кошелька при исчерпании квоты). */
export async function getGenerationKopecksPerCredit(): Promise<number> {
  const v = await configStore.get(KEYS.kopecksPerCredit);
  if (v == null || v === "") return DEFAULT_KOPECKS_PER_CREDIT;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return DEFAULT_KOPECKS_PER_CREDIT;
  return n;
}

export async function setGenerationKopecksPerCredit(kopecks: number): Promise<void> {
  const value = Math.max(0, Math.round(kopecks));
  await configStore.set(KEYS.kopecksPerCredit, String(value), {
    category: "generation",
    description: "Копеек за 1 кредит генерации (докупка с кошелька)",
  });
}

export const GENERATION_MARGIN_CONFIG_KEY = KEYS.marginPercent;
export { MIN_MARGIN as GENERATION_MIN_MARGIN, MAX_MARGIN as GENERATION_MAX_MARGIN };
