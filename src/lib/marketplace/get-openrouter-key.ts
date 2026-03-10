import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "marketplace.openrouter_api_key";

/**
 * Get OpenRouter API key for marketplace proxy.
 * Uses dedicated admin setting (Настройки → Маркетплейс), separate from document-processing providers.
 */
export async function getOpenRouterApiKey(): Promise<string | null> {
  const key = await configStore.get(CONFIG_KEY);
  return key && key.length > 0 ? key : null;
}
