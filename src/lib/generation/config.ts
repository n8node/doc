import { configStore } from "@/lib/config-store";

const KEYS = {
  imageEnabled: "generation.image_enabled",
  imageTasks: "generation.image_tasks",
  imageModels: "generation.image_models",
  marginPercent: "generation.margin_percent",
} as const;

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

/**
 * Сбросить задачи и модели к умолчанию (пустой список в БД → при чтении вернутся DEFAULT_TASKS и DEFAULT_MODELS).
 */
export async function resetImageGenerationTasksAndModels(): Promise<void> {
  await setImageTasksConfig([]);
  await setImageModelsConfig([]);
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
    description: "Наценка % на кредиты при генерации изображений/видео",
  });
}

/**
 * Применить наценку к количеству кредитов (для отображения пользователю).
 * marginPercent 50 → billedCredits = rawCredits * 100 / (100 - 50) = 2×.
 */
export function applyGenerationMargin(rawCredits: number, marginPercent: number): number {
  if (marginPercent <= 0) return rawCredits;
  const divisor = 100 - marginPercent;
  if (divisor <= 0) return rawCredits;
  return Math.max(rawCredits, Math.round((rawCredits * 100) / divisor));
}

export const GENERATION_MARGIN_CONFIG_KEY = KEYS.marginPercent;
export { MIN_MARGIN as GENERATION_MIN_MARGIN, MAX_MARGIN as GENERATION_MAX_MARGIN };
