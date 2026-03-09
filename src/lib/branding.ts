import { configStore } from "./config-store";

export const DEFAULT_SITE_NAME = "qoqon.ru";

export type BrandingConfig = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  sidebarSubtitle: string;
};

export const DEFAULT_SIDEBAR_SUBTITLE = "Новая навигация (beta)";

function isValidKind(kind: string): kind is "logo" | "favicon" {
  return kind === "logo" || kind === "favicon";
}

export function getBrandingAssetUrl(kind: "logo" | "favicon"): string {
  return `/api/public/branding/${kind}`;
}

export async function getBrandingConfig(): Promise<BrandingConfig> {
  try {
    const [siteNameRaw, logoKey, faviconKey, sidebarSubtitleRaw] = await Promise.all([
      configStore.get("branding.site_name"),
      configStore.get("branding.logo_key"),
      configStore.get("branding.favicon_key"),
      configStore.get("branding.sidebar_subtitle"),
    ]);
    const siteName = (siteNameRaw ?? "").trim() || DEFAULT_SITE_NAME;
    const sidebarSubtitle = (sidebarSubtitleRaw ?? "").trim() || DEFAULT_SIDEBAR_SUBTITLE;
    return {
      siteName,
      logoUrl: logoKey ? getBrandingAssetUrl("logo") : null,
      faviconUrl: faviconKey ? getBrandingAssetUrl("favicon") : null,
      sidebarSubtitle,
    };
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME,
      logoUrl: null,
      faviconUrl: null,
      sidebarSubtitle: DEFAULT_SIDEBAR_SUBTITLE,
    };
  }
}

export async function getSiteName(): Promise<string> {
  const cfg = await getBrandingConfig();
  return cfg.siteName;
}

export function getBrandingAssetConfigKeys(kind: string) {
  if (!isValidKind(kind)) return null;
  if (kind === "logo") {
    return {
      keyKey: "branding.logo_key",
      mimeKey: "branding.logo_mime",
    } as const;
  }
  return {
    keyKey: "branding.favicon_key",
    mimeKey: "branding.favicon_mime",
  } as const;
}
