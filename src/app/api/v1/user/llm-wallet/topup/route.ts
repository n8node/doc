import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getYookassaConfig, createYookassaPayment } from "@/lib/yookassa";
import { nanoid } from "nanoid";
import { getPublicBaseUrl } from "@/lib/app-url";

/**
 * POST /api/v1/user/llm-wallet/topup — инициировать пополнение (session only)
 * Body: { amountCents: number } — сумма в копейках (100 = 1 руб)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amountCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
  const amountRub = Math.round(amountCents / 100);
  if (amountRub < 10) {
    return NextResponse.json(
      { error: "Минимальная сумма пополнения — 10 ₽" },
      { status: 400 }
    );
  }
  if (amountRub > 1_000_000) {
    return NextResponse.json(
      { error: "Максимальная сумма — 1 000 000 ₽" },
      { status: 400 }
    );
  }

  const yookassaConfig = await getYookassaConfig();
  if (!yookassaConfig) {
    return NextResponse.json(
      { error: "Оплата недоступна. Обратитесь к администратору." },
      { status: 503 }
    );
  }

  const payer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!payer?.email?.trim()) {
    return NextResponse.json(
      { error: "Укажите email в профиле — он нужен для фискального чека по 54‑ФЗ." },
      { status: 400 },
    );
  }

  const topup = await prisma.llmWalletTopup.create({
    data: {
      userId: session.user.id,
      amountCents: amountRub * 100,
      status: "pending",
    },
  });

  const returnUrl = `${getPublicBaseUrl()}/dashboard/marketplace?topup=success`;
  const idempotenceKey = `llm-topup-${topup.id}-${nanoid(8)}`;
  const result = await createYookassaPayment({
    amount: amountRub,
    description: `Пополнение LLM маркетплейса — ${amountRub} ₽`,
    returnUrl,
    metadata: { llmTopupId: topup.id },
    config: yookassaConfig,
    idempotenceKey,
    customerEmail: payer.email.trim(),
  });

  if ("error" in result) {
    await prisma.llmWalletTopup.update({
      where: { id: topup.id },
      data: { status: "canceled" },
    });
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  await prisma.llmWalletTopup.update({
    where: { id: topup.id },
    data: { yookassaPaymentId: result.paymentId },
  });

  return NextResponse.json({
    ok: true,
    confirmationUrl: result.confirmationUrl,
    amountCents: topup.amountCents,
    topupId: topup.id,
  });
}
