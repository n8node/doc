import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getSeoConfig } from "@/lib/seo";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getSeoConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Promise<void>[] = [];

  if (typeof body.title === "string") {
    updates.push(
      configStore.set("seo.title", body.title.trim(), {
        category: "seo",
        description: "SEO title страницы",
      })
    );
  }

  if (typeof body.description === "string") {
    updates.push(
      configStore.set("seo.description", body.description.trim(), {
        category: "seo",
        description: "SEO description",
      })
    );
  }

  if (typeof body.keywords === "string") {
    updates.push(
      configStore.set("seo.keywords", body.keywords.trim(), {
        category: "seo",
        description: "SEO keywords",
      })
    );
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Нет данных для сохранения" }, { status: 400 });
  }

  await Promise.all(updates);

  ["seo.title", "seo.description", "seo.keywords"].forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
