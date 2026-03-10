import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/user/llm-wallet — баланс и история (session only)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { llmWalletBalanceCents: true },
  });

  const [topups, usage] = await Promise.all([
    prisma.llmWalletTopup.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amountCents: true,
        status: true,
        createdAt: true,
        succeededAt: true,
      },
    }),
    prisma.marketplaceUsageEvent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        category: true,
        model: true,
        tokensIn: true,
        tokensOut: true,
        costCents: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    balanceCents: user?.llmWalletBalanceCents ?? 0,
    topups: topups.map((t) => ({
      id: t.id,
      amountCents: t.amountCents,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      succeededAt: t.succeededAt?.toISOString() ?? null,
    })),
    usage: usage.map((u) => ({
      id: u.id,
      category: u.category,
      model: u.model,
      tokensIn: u.tokensIn,
      tokensOut: u.tokensOut,
      costCents: u.costCents,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
