import { configStore } from "./config-store";

export const DEFAULT_SITE_NAME = "qoqon.ru";

export async function getSiteName(): Promise<string> {
  const value = await configStore.get("branding.site_name");
  const normalized = (value ?? "").trim();
  return normalized || DEFAULT_SITE_NAME;
}
