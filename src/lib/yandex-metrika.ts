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

    let finalCounterId: string | null = null;
    const trimmed = counterId?.trim();
    if (trimmed) {
      finalCounterId = trimmed;
    } else if (counterId === null) {
      finalCounterId =
        process.env.YANDEX_METRIKA_COUNTER_ID?.trim() ||
        process.env.NEXT_PUBLIC_YANDEX_METRIKA_COUNTER_ID?.trim() ||
        "107730757";
    }

    return {
      counterId: finalCounterId,
      webvisor: parseBool(webvisor ?? "true"),
      clickmap: parseBool(clickmap ?? "true"),
      ecommerce: (ecommerce?.trim() || "dataLayer") as string,
      accurateTrackBounce: parseBool(accurateTrackBounce ?? "true"),
      trackLinks: parseBool(trackLinks ?? "true"),
    };
  } catch {
    const fallbackId =
      process.env.YANDEX_METRIKA_COUNTER_ID?.trim() ||
      process.env.NEXT_PUBLIC_YANDEX_METRIKA_COUNTER_ID?.trim() ||
      "107730757";
    return {
      counterId: fallbackId,
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

/** Строка скрипта для вставки в HTML (серверный рендер) */
export function buildYandexMetrikaScriptInline(config: YandexMetrikaConfig): string {
  const id = config.counterId?.trim();
  if (!id || !/^\d+$/.test(id)) return "";

  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const ecommerce = esc(config.ecommerce || "dataLayer");

  return [
    "(function(m,e,t,r,i,k,a){",
    "m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};",
    "m[i].l=1*new Date();",
    "for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return;}",
    "k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);",
    "})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=" + id + "','ym');",
    "ym(" + id + ",'init',{ssr:true,webvisor:" + config.webvisor + ",clickmap:" + config.clickmap + ',ecommerce:"' + ecommerce + '",referrer:document.referrer,url:location.href,accurateTrackBounce:' + config.accurateTrackBounce + ",trackLinks:" + config.trackLinks + "});",
  ].join("");
}
