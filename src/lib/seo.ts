import { configStore } from "./config-store";

export type SeoConfig = {
  title: string | null;
  description: string | null;
  keywords: string | null;
};

export async function getSeoConfig(): Promise<SeoConfig> {
  try {
    const [title, description, keywords] = await Promise.all([
      configStore.get("seo.title"),
      configStore.get("seo.description"),
      configStore.get("seo.keywords"),
    ]);
    return {
      title: title?.trim() || null,
      description: description?.trim() || null,
      keywords: keywords?.trim() || null,
    };
  } catch {
    return { title: null, description: null, keywords: null };
  }
}
