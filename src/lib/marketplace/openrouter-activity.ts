import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.openrouter_management_api_key";
const OPENROUTER_ACTIVITY_URL = "https://openrouter.ai/api/v1/activity";

export interface ActivityItem {
  date: string;
  model: string;
  model_permaslug: string;
  endpoint_id: string;
  provider_name: string;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
}

export interface OpenRouterActivityResponse {
  data: ActivityItem[];
}

/**
 * Получить Management API ключ OpenRouter из конфига
 */
export async function getOpenRouterActivityManagementKey(): Promise<string | null> {
  const key = await configStore.get(CONFIG_KEY);
  return key && key.length > 0 ? key : null;
}

/**
 * Запросить данные активности из OpenRouter Activity API
 * @param date — опционально, фильтр по дате (YYYY-MM-DD)
 */
export async function fetchOpenRouterActivity(params?: {
  date?: string;
}): Promise<OpenRouterActivityResponse | null> {
  const apiKey = await getOpenRouterActivityManagementKey();
  if (!apiKey) return null;

  const url = new URL(OPENROUTER_ACTIVITY_URL);
  if (params?.date) {
    url.searchParams.set("date", params.date);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) return null;

  const parsed = (await res.json()) as { data?: unknown[] };
  if (Array.isArray(parsed?.data)) {
    return parsed as OpenRouterActivityResponse;
  }
  return null;
}
