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
  name: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

const DEFAULT_TASKS: ImageTaskConfig[] = [
  { id: "text_to_image", label: "Генерация по описанию", enabled: true, order: 1 },
  { id: "edit_image", label: "Редактирование по промпту", enabled: true, order: 2 },
  { id: "variations", label: "Вариации по образцу", enabled: true, order: 3 },
];

const DEFAULT_MODELS: ImageModelConfig[] = [
  { id: "kie-4o-image", name: "4o Image", description: "Фотореализм, работа с текстом", enabled: true, taskIds: ["text_to_image", "edit_image", "variations"], order: 1 },
  { id: "kie-flux-kontext", name: "Flux Kontext", description: "Стилизованные сцены", enabled: true, taskIds: ["text_to_image", "edit_image"], order: 2 },
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
