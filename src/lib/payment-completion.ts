import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  sendTelegramMessage,
  formatPaymentMessage,
  formatLlmWalletTopupMessage,
} from "@/lib/telegram";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";

/** Завершение пополнения LLM-кошелька после подтверждения платёжной системы. */
export async function finalizeLlmWalletTopupSuccess(topupId: string): Promise<boolean> {
  const topup = await prisma.llmWalletTopup.findUnique({
    where: { id: topupId },
    select: { id: true, userId: true, amountCents: true, status: true },
  });
  if (!topup || topup.status !== "pending") {
    return false;
  }

  await prisma.$transaction([
    prisma.llmWalletTopup.update({
      where: { id: topup.id },
      data: { status: "succeeded", succeededAt: new Date() },
    }),
    prisma.user.update({
      where: { id: topup.userId },
      data: {
        llmWalletBalanceCents: { increment: topup.amountCents },
      },
    }),
  ]);

  try {
    const u = await prisma.user.findUnique({
      where: { id: topup.userId },
      select: {
        email: true,
        name: true,
        llmWalletBalanceCents: true,
      },
    });
    const balanceRub = u ? Math.round(Number(u.llmWalletBalanceCents) / 100) : 0;
    const amountRub = Math.round(topup.amountCents / 100);
    await sendUserTelegramNotify(topup.userId, "llm_topup", {
      amount: amountRub,
      balance: balanceRub,
    });
    const tg = await getTelegramConfig();
    if (tg.notifyLlmWalletTopupEnabled && tg.botToken && tg.chatId && u) {
      const text = formatLlmWalletTopupMessage(tg.llmWalletTopupMessage, {
        userEmail: u.email,
        userName: u.name,
        amount: amountRub,
        balance: balanceRub,
        currency: "RUB",
      });
      await sendTelegramMessage(tg.botToken, tg.chatId, text);
    }
  } catch {
    // ignore
  }

  return true;
}

/** Завершение оплаты тарифа после подтверждения платёжной системы. */
export async function finalizePlanPaymentSuccess(paymentDbId: string): Promise<boolean> {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentDbId },
    select: { id: true, userId: true, planId: true, status: true },
  });
  if (!existing || existing.status !== "pending") {
    return false;
  }

  const plan = await prisma.plan.findUnique({ where: { id: existing.planId } });
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: existing.id },
      data: { status: "succeeded", paidAt: new Date() },
    }),
    prisma.user.update({
      where: { id: existing.userId },
      data: {
        planId: existing.planId,
        ...(plan && {
          storageQuota: plan.storageQuota,
          maxFileSize: plan.maxFileSize,
        }),
      },
    }),
  ]);

  try {
    const tg = await getTelegramConfig();
    if (tg.notifyPaymentEnabled && tg.botToken && tg.chatId) {
      const paid = await prisma.payment.findUnique({
        where: { id: existing.id },
        select: {
          amount: true,
          currency: true,
          user: { select: { email: true, name: true } },
          plan: { select: { name: true } },
        },
      });
      if (paid) {
        const text = formatPaymentMessage(tg.paymentMessage, {
          userEmail: paid.user.email,
          userName: paid.user.name,
          planName: paid.plan?.name ?? "",
          amount: paid.amount,
          currency: paid.currency,
        });
        await sendTelegramMessage(tg.botToken, tg.chatId, text);
      }
    }
    await sendUserTelegramNotify(existing.userId, "plan_subscribe", {
      planName: plan?.name ?? "",
    });
  } catch {
    // ignore telegram errors
  }

  return true;
}
