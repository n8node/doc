import { NextResponse } from "next/server";
import { getMetadataBaseUrl } from "@/lib/app-url";
import { configStore } from "@/lib/config-store";

export const dynamic = "force-dynamic";

function redirectBaseUrl(request: Request): string {
  try {
    const u = new URL(request.url);
    if (u.hostname === "0.0.0.0" || u.hostname === "[::]") {
      return getMetadataBaseUrl();
    }
    return u.origin;
  } catch {
    return getMetadataBaseUrl();
  }
}

/**
 * Redirect /favicon.ico to the versioned branding URL.
 * Used by next.config rewrite so the browser always gets a cache-busting URL.
 */
export async function GET(request: Request) {
  const faviconKey = await configStore.get("branding.favicon_key");
  const baseUrl = redirectBaseUrl(request);

  if (faviconKey) {
    const target = `${baseUrl}/api/public/branding/favicon?v=${encodeURIComponent(faviconKey)}`;
    const res = NextResponse.redirect(target, 302);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  return new NextResponse(null, { status: 404 });
}
