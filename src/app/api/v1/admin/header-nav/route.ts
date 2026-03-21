import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getHeaderNavConfig,
  setHeaderNavConfig,
  type HeaderNavConfig,
} from "@/lib/header-nav-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await getHeaderNavConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<HeaderNavConfig>;
  const current = await getHeaderNavConfig();

  const items = Array.isArray(body.items)
    ? body.items
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const o = it as { label?: unknown; href?: unknown };
          const label = typeof o.label === "string" ? o.label.trim() : "";
          const href = typeof o.href === "string" ? o.href.trim() : "";
          if (!label || !href) return null;
          return { label, href };
        })
        .filter((x): x is { label: string; href: string } => x !== null)
    : current.items;

  if (items.length === 0) {
    return NextResponse.json({ error: "Нужен хотя бы один пункт меню" }, { status: 400 });
  }

  const config: HeaderNavConfig = { items };
  await setHeaderNavConfig(config);
  return NextResponse.json({ ok: true });
}
