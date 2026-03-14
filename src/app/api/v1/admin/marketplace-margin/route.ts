import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { MARGIN_CONFIG_KEY, MIN_MARGIN, MAX_MARGIN } from "@/lib/marketplace/margin";

/**
 * GET — получить текущий процент маржи маркетплейса
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const v = await configStore.get(MARGIN_CONFIG_KEY);
  const marginPercent =
    v != null && v !== ""
      ? Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, parseInt(v, 10) || 0))
      : 0;

  return NextResponse.json({ marginPercent });
}

/**
 * POST — сохранить процент маржи
 * Body: { marginPercent?: number } — 0–95
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let marginPercent = typeof body.marginPercent === "number" ? body.marginPercent : null;
  if (marginPercent == null && typeof body.marginPercent === "string") {
    marginPercent = parseInt(body.marginPercent, 10);
  }
  if (marginPercent == null || Number.isNaN(marginPercent)) {
    return NextResponse.json(
      { error: "Укажите marginPercent (0–95)" },
      { status: 400 }
    );
  }

  const clamped = Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(marginPercent)));
  await configStore.set(MARGIN_CONFIG_KEY, String(clamped), {
    category: "finance",
    description: "Platform margin percent for LLM marketplace (0-95)",
  });
  configStore.invalidate(MARGIN_CONFIG_KEY);

  return NextResponse.json({ ok: true, marginPercent: clamped });
}
