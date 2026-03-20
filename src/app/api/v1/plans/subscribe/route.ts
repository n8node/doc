import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getYookassaConfig, createYookassaPayment } from "@/lib/yookassa";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const planId = body?.planId;
  const period = body?.period === "yearly" ? "yearly" : "monthly";

  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId обязателен" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Тариф не найден" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planId: true, email: true },
  });

  if (user?.planId === planId) {
    return NextResponse.json({ error: "Вы уже на этом тарифе" }, { status: 400 });
  }

  if (plan.isFree) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        planId: plan.id,
        storageQuota: plan.storageQuota,
        maxFileSize: plan.maxFileSize,
      },
    });

    return NextResponse.json({
      ok: true,
      requiresPayment: false,
      plan: {
        id: plan.id,
        name: plan.name,
      },
    });
  }

  // Платный тариф — оплата через ЮKassa
  const amount = period === "yearly" && plan.priceYearly != null
    ? plan.priceYearly
    : plan.priceMonthly ?? 0;

  if (amount <= 0) {
    return NextResponse.json(
      { error: "Цена тарифа не задана" },
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

  if (!user?.email?.trim()) {
    return NextResponse.json(
      { error: "Укажите email в профиле — он нужен для фискального чека по 54‑ФЗ." },
      { status: 400 },
    );
  }

  const description =
    period === "yearly"
      ? `Тариф ${plan.name} — 1 год`
      : `Тариф ${plan.name} — 1 месяц`;

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      planId: plan.id,
      amount,
      currency: "RUB",
      status: "pending",
    },
  });

  const idempotenceKey = `${payment.id}-${nanoid(8)}`;
  const returnUrlWithSuccess = `${yookassaConfig.returnUrl.replace(/\?.*$/, "")}?payment=success`;
  const result = await createYookassaPayment({
    amount,
    description,
    returnUrl: returnUrlWithSuccess,
    metadata: { paymentId: payment.id },
    config: yookassaConfig,
    idempotenceKey,
    customerEmail: user.email.trim(),
  });

  if ("error" in result) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "canceled" },
    });
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { yookassaPaymentId: result.paymentId },
  });

  return NextResponse.json({
    ok: true,
    requiresPayment: true,
    confirmationUrl: result.confirmationUrl,
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
    },
  });
}
