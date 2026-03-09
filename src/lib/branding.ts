import { configStore } from "./config-store";

export const DEFAULT_SITE_NAME = "qoqon.ru";

export type BrandingConfig = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

function isValidKind(kind: string): kind is "logo" | "favicon" {
  return kind === "logo" || kind === "favicon";
}

export function getBrandingAssetUrl(kind: "logo" | "favicon"): string {
  return `/api/public/branding/${kind}`;
}

export async function getBrandingConfig(): Promise<BrandingConfig> {
  try {
    const [siteNameRaw, logoKey, faviconKey] = await Promise.all([
      configStore.get("branding.site_name"),
      configStore.get("branding.logo_key"),
      configStore.get("branding.favicon_key"),
    ]);
    const siteName = (siteNameRaw ?? "").trim() || DEFAULT_SITE_NAME;
    return {
      siteName,
      logoUrl: logoKey ? getBrandingAssetUrl("logo") : null,
      faviconUrl: faviconKey ? getBrandingAssetUrl("favicon") : null,
    };
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME,
      logoUrl: null,
      faviconUrl: null,
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
