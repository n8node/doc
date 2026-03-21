import { configStore } from "./config-store";

export type HeaderNavItem = { label: string; href: string };
export type HeaderNavConfig = { items: HeaderNavItem[] };

const CONFIG_KEY = "header_nav.config_json";

const DEFAULT_ITEMS: HeaderNavItem[] = [
  { label: "Возможности", href: "/#features" },
  { label: "Как это работает", href: "/#how-it-works" },
  { label: "Документация", href: "/docs" },
  { label: "Дорожная карта", href: "/roadmap" },
  { label: "Личный кабинет", href: "/dashboard" },
];

function normalizeItems(raw: unknown): HeaderNavItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const o = it as { label?: unknown; href?: unknown };
      const label = typeof o.label === "string" ? o.label.trim() : "";
      const href = typeof o.href === "string" ? o.href.trim() : "";
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((x): x is HeaderNavItem => x !== null);
}

export async function getHeaderNavConfig(): Promise<HeaderNavConfig> {
  try {
    const raw = await configStore.get(CONFIG_KEY);
    if (!raw || typeof raw !== "string") {
      return { items: [...DEFAULT_ITEMS] };
    }
    const parsed = JSON.parse(raw) as Partial<HeaderNavConfig>;
    const items = normalizeItems(parsed.items);
    return {
      items: items.length > 0 ? items : [...DEFAULT_ITEMS],
    };
  } catch {
    return { items: [...DEFAULT_ITEMS] };
  }
}

export async function setHeaderNavConfig(config: HeaderNavConfig): Promise<void> {
  await configStore.set(CONFIG_KEY, JSON.stringify(config), {
    category: "layout",
    description: "Меню верхней навигации (шапка)",
  });
  configStore.invalidate(CONFIG_KEY);
}
