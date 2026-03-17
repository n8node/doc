import { configStore } from "@/lib/config-store";

const CONFIG_KEY = "kie.api_key";

export async function getKieApiKey(): Promise<string | null> {
  const key = await configStore.get(CONFIG_KEY);
  return key && key.length > 0 ? key : null;
}

export function invalidateKieApiKey(): void {
  configStore.invalidate(CONFIG_KEY);
}
