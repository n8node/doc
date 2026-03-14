import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const RESET_SECRET_KEY = "7774";

/**
 * POST /api/v1/admin/marketplace-reset
 * Сброс финансовой статистики: маркетплейс, тарифы, все пользователи → бесплатный план.
 * Требует secretKey в body. API-ключи маркетплейса сохраняются.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const secretKey = typeof body.secretKey === "string" ? body.secretKey.trim() : "";
  if (secretKey !== RESET_SECRET_KEY) {
    return NextResponse.json(
      { error: "Неверный секретный ключ" },
      { status: 400 }
    );
  }

  const freePlan = await prisma.plan.findFirst({
    where: { isFree: true },
    select: { id: true },
  });
  if (!freePlan) {
    return NextResponse.json(
      { error: "Не найден бесплатный тариф (plan с isFree: true)" },
      { status: 500 }
    );
  }

  await prisma.$transaction([
    prisma.marketplaceUsageEvent.deleteMany(),
    prisma.llmWalletTopup.deleteMany(),
    prisma.tokenUsageEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.user.updateMany({
      data: {
        llmWalletBalanceCents: 0,
        planId: freePlan.id,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    message:
      "Данные сброшены: usage, topups, token_usage, payments. Все пользователи переведены на бесплатный план. API-ключи сохранены.",
  });
}
