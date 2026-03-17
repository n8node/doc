import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { syncKiePricing } from "@/lib/generation/kie-pricing-sync";

/**
 * POST /api/v1/admin/generation/pricing/sync
 * Синхронизировать прайс с kie.ai/pricing (раз в сутки или по кнопке в админке).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncKiePricing();
  return NextResponse.json(result);
}
