import { configStore } from "./config-store";
import { getSiteName } from "./branding";

export type FooterItem = { label: string; href: string };
export type FooterColumn = { title: string; items: FooterItem[] };
export type SocialPlatform = "telegram" | "vk" | "github";
export type SocialLink = { platform: SocialPlatform; url: string };
export type FooterConfig = {
  columns: FooterColumn[];
  social: SocialLink[];
  copyright: string;
};

const CONFIG_KEY = "footer.config_json";

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Навигация",
    items: [
      { label: "Документация", href: "/docs" },
      { label: "Личный кабинет", href: "/dashboard" },
      { label: "Вход", href: "/login" },
    ],
  },
];

export function resolveCopyright(raw: string): string {
  const year = new Date().getFullYear();
  return raw.replace(/\{year\}/g, String(year));
}

export async function getFooterConfig(): Promise<FooterConfig> {
  try {
    const raw = await configStore.get(CONFIG_KEY);
    if (!raw || typeof raw !== "string") {
      const siteName = await getSiteName();
      return {
        columns: DEFAULT_COLUMNS,
        social: [],
        copyright: `© ${new Date().getFullYear()} ${siteName} — Облачное хранилище с AI`,
      };
    }
    const parsed = JSON.parse(raw) as Partial<FooterConfig>;
    const siteName = await getSiteName();
    return {
      columns: Array.isArray(parsed.columns) && parsed.columns.length > 0
        ? parsed.columns
        : DEFAULT_COLUMNS,
      social: Array.isArray(parsed.social) ? parsed.social.filter(
        (s): s is SocialLink => s && typeof s.platform === "string" && typeof s.url === "string"
      ) : [],
      copyright:
        typeof parsed.copyright === "string" && parsed.copyright.trim()
          ? parsed.copyright.trim()
          : `© ${new Date().getFullYear()} ${siteName} — Облачное хранилище с AI`,
    };
  } catch {
    const siteName = await getSiteName();
    return {
      columns: DEFAULT_COLUMNS,
      social: [],
      copyright: `© ${new Date().getFullYear()} ${siteName} — Облачное хранилище с AI`,
    };
  }
}

export async function setFooterConfig(config: FooterConfig): Promise<void> {
  await configStore.set(CONFIG_KEY, JSON.stringify(config), {
    category: "footer",
    description: "Конфигурация футера сайта",
  });
  configStore.invalidate(CONFIG_KEY);
}
