import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const batches = await prisma.openRouterTopupBatch.findMany({
    orderBy: { toppedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      usdAmount: b.usdAmount,
      rubSpentCents: b.rubSpentCents,
      rubFeeCents: b.rubFeeCents,
      effectiveRateRubPerUsd: b.effectiveRateRubPerUsd,
      usdRemaining: b.usdRemaining,
      source: b.source,
      comment: b.comment,
      toppedAt: b.toppedAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const usdAmount = typeof body.usdAmount === "number" ? body.usdAmount : parseFloat(body.usdAmount);
  const rubSpentCents = typeof body.rubSpentCents === "number" ? body.rubSpentCents : parseInt(String(body.rubSpentCents || 0), 10);
  const rubFeeCents = typeof body.rubFeeCents === "number" ? body.rubFeeCents : parseInt(String(body.rubFeeCents || 0), 10);
  const toppedAt = body.toppedAt ? new Date(body.toppedAt) : new Date();
  const source = typeof body.source === "string" ? body.source : null;
  const comment = typeof body.comment === "string" ? body.comment : null;

  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return NextResponse.json({ error: "usdAmount must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(rubSpentCents) || rubSpentCents < 0) {
    return NextResponse.json({ error: "rubSpentCents must be a non-negative number" }, { status: 400 });
  }
  if (!Number.isFinite(rubFeeCents) || rubFeeCents < 0) {
    return NextResponse.json({ error: "rubFeeCents must be a non-negative number" }, { status: 400 });
  }

  const totalRubCents = rubSpentCents + rubFeeCents;
  const effectiveRateRubPerUsd = totalRubCents / 100 / usdAmount;

  const batch = await prisma.openRouterTopupBatch.create({
    data: {
      usdAmount,
      rubSpentCents,
      rubFeeCents,
      effectiveRateRubPerUsd,
      usdRemaining: usdAmount,
      source,
      comment,
      toppedAt,
    },
  });

  return NextResponse.json({
    id: batch.id,
    usdAmount: batch.usdAmount,
    rubSpentCents: batch.rubSpentCents,
    rubFeeCents: batch.rubFeeCents,
    effectiveRateRubPerUsd: batch.effectiveRateRubPerUsd,
    usdRemaining: batch.usdRemaining,
    source: batch.source,
    comment: batch.comment,
    toppedAt: batch.toppedAt.toISOString(),
    createdAt: batch.createdAt.toISOString(),
  });
}
