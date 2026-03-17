import { configStore } from "./config-store";

export type YandexMetrikaConfig = {
  counterId: string | null;
  webvisor: boolean;
  clickmap: boolean;
  ecommerce: string | null;
  accurateTrackBounce: boolean;
  trackLinks: boolean;
};

function parseBool(value: string | null): boolean {
  if (value === null || value === undefined) return true;
  return value.trim().toLowerCase() === "true" || value.trim() === "1";
}

export async function getYandexMetrikaConfig(): Promise<YandexMetrikaConfig> {
  try {
    const [counterId, webvisor, clickmap, ecommerce, accurateTrackBounce, trackLinks] =
      await Promise.all([
        configStore.get("yandex_metrika.counter_id"),
        configStore.get("yandex_metrika.webvisor"),
        configStore.get("yandex_metrika.clickmap"),
        configStore.get("yandex_metrika.ecommerce"),
        configStore.get("yandex_metrika.accurate_track_bounce"),
        configStore.get("yandex_metrika.track_links"),
      ]);

    return {
      counterId: counterId?.trim() || null,
      webvisor: parseBool(webvisor ?? "true"),
      clickmap: parseBool(clickmap ?? "true"),
      ecommerce: (ecommerce?.trim() || "dataLayer") as string,
      accurateTrackBounce: parseBool(accurateTrackBounce ?? "true"),
      trackLinks: parseBool(trackLinks ?? "true"),
    };
  } catch {
    return {
      counterId: null,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      accurateTrackBounce: true,
      trackLinks: true,
    };
  }
}

export const YANDEX_METRIKA_CONFIG_KEYS = [
  "yandex_metrika.counter_id",
  "yandex_metrika.webvisor",
  "yandex_metrika.clickmap",
  "yandex_metrika.ecommerce",
  "yandex_metrika.accurate_track_bounce",
  "yandex_metrika.track_links",
] as const;
