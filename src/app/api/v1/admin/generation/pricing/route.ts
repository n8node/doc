import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/admin/generation/pricing
 * Список цен из таблицы kie_pricing (последний fetchedAt по каждой паре modelId+variant).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.kiePricing.findMany({
    orderBy: [{ modelId: "asc" }, { variant: "asc" }],
  });
  const fetchedAt = rows.length > 0
    ? rows.reduce((max, r) => (r.fetchedAt > max ? r.fetchedAt : max), rows[0].fetchedAt)
    : null;
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      modelId: r.modelId,
      variant: r.variant,
      priceCredits: r.priceCredits,
      priceUsd: r.priceUsd,
      fetchedAt: r.fetchedAt.toISOString(),
    })),
    fetchedAt: fetchedAt?.toISOString() ?? null,
  });
}

/**
 * PATCH /api/v1/admin/generation/pricing
 * Обновить стоимость в кредитах вручную. Body: { id: string, priceCredits: number }.
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; priceCredits?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, priceCredits } = body;
  if (!id || typeof priceCredits !== "number" || priceCredits < 0) {
    return NextResponse.json({ error: "id and priceCredits (non-negative number) required" }, { status: 400 });
  }

  await prisma.kiePricing.update({
    where: { id },
    data: { priceCredits },
  });
  return NextResponse.json({ ok: true });
}
