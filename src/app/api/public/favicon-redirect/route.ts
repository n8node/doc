import { NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";

export const dynamic = "force-dynamic";

/**
 * Redirect /favicon.ico to the versioned branding URL.
 * Used by next.config rewrite so the browser always gets a cache-busting URL.
 */
export async function GET(request: Request) {
  const faviconKey = await configStore.get("branding.favicon_key");
  const baseUrl = new URL(request.url).origin;

  if (faviconKey) {
    const target = `${baseUrl}/api/public/branding/favicon?v=${encodeURIComponent(faviconKey)}`;
    const res = NextResponse.redirect(target, 302);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  return new NextResponse(null, { status: 404 });
}
