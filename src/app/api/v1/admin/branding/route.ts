import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { DEFAULT_SIDEBAR_SUBTITLE, getBrandingConfig } from "@/lib/branding";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getBrandingConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Promise<void>[] = [];

  if (typeof body.siteName === "string") {
    const value = body.siteName.trim() || "qoqon.ru";
    updates.push(
      configStore.set("branding.site_name", value, {
        category: "branding",
        description: "Название сайта",
      })
    );
  }

  if (typeof body.sidebarSubtitle === "string") {
    const value = body.sidebarSubtitle.trim() || DEFAULT_SIDEBAR_SUBTITLE;
    updates.push(
      configStore.set("branding.sidebar_subtitle", value, {
        category: "branding",
        description: "Подзаголовок в боковом меню",
      })
    );
  }

  if (body.removeLogo === true) {
    updates.push(
      configStore.set("branding.logo_key", "", {
        category: "branding",
        description: "S3 key логотипа",
      })
    );
    updates.push(
      configStore.set("branding.logo_mime", "", {
        category: "branding",
        description: "MIME логотипа",
      })
    );
  }

  if (body.removeFavicon === true) {
    updates.push(
      configStore.set("branding.favicon_key", "", {
        category: "branding",
        description: "S3 key favicon",
      })
    );
    updates.push(
      configStore.set("branding.favicon_mime", "", {
        category: "branding",
        description: "MIME favicon",
      })
    );
  }

  await Promise.all(updates);

  [
    "branding.site_name",
    "branding.logo_key",
    "branding.logo_mime",
    "branding.favicon_key",
    "branding.favicon_mime",
    "branding.sidebar_subtitle",
  ].forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
