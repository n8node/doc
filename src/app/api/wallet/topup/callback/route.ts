import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  sendTelegramMessage,
  formatPaymentMessage,
} from "@/lib/telegram";
import { sendUserTelegramNotify } from "@/lib/user-telegram-notify";

/**
 * POST /api/wallet/topup/callback
 * Webhook от ЮKassa для HTTP-уведомлений о статусе платежа.
 * URL указывается в ЮKassa → Интеграция → HTTP-уведомления.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = body?.event as string | undefined;
    const paymentObj = body?.object as Record<string, unknown> | undefined;
    const paymentId = paymentObj?.id as string | undefined;

    if (event === "payment.succeeded" && paymentId) {
      const metadata = paymentObj?.metadata as Record<string, string> | undefined;
      const llmTopupId = metadata?.llmTopupId;

      // LLM-маркетплейс: пополнение баланса
      if (llmTopupId) {
        const topup = await prisma.llmWalletTopup.findUnique({
          where: { id: llmTopupId },
          select: { id: true, userId: true, amountCents: true, status: true },
        });
        if (topup && topup.status === "pending") {
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
              select: { llmWalletBalanceCents: true },
            });
            const balanceRub = u ? Math.round(Number(u.llmWalletBalanceCents) / 100) : 0;
            await sendUserTelegramNotify(topup.userId, "llm_topup", {
              amount: Math.round(topup.amountCents / 100),
              balance: balanceRub,
            });
          } catch {
            // ignore
          }
        }
      } else {
        // Обычная оплата тарифа
        const existing = await prisma.payment.findUnique({
          where: { yookassaPaymentId: paymentId },
          select: { id: true, userId: true, planId: true, status: true },
        });

        if (existing && existing.status === "pending") {
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
        }
      }
    }

    if (event === "payment.canceled" && paymentId) {
      const metadata = paymentObj?.metadata as Record<string, string> | undefined;
      const llmTopupId = metadata?.llmTopupId;
      if (llmTopupId) {
        await prisma.llmWalletTopup.updateMany({
          where: { id: llmTopupId },
          data: { status: "canceled" },
        });
      } else {
        await prisma.payment.updateMany({
          where: { yookassaPaymentId: paymentId },
          data: { status: "canceled" },
        });
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 200 });
  }
}
