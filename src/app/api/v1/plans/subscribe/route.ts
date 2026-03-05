import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await req.json();
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId обязателен" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Тариф не найден" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planId: true },
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

  // Платный тариф — пока подключаем напрямую (заглушка для ЮKassa)
  // TODO: Интеграция с ЮKassa:
  // 1. Создать Payment со статусом pending
  // 2. Создать платёж в ЮKassa API
  // 3. Вернуть confirmationUrl для редиректа
  // 4. По webhook обработать результат

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
    requiresPayment: true,
    paymentPending: false,
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
    },
  });
}
