import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  finalizeLlmWalletTopupSuccess,
  finalizePlanPaymentSuccess,
} from "@/lib/payment-completion";

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

      if (llmTopupId) {
        await finalizeLlmWalletTopupSuccess(llmTopupId);
      } else {
        const existing = await prisma.payment.findUnique({
          where: { yookassaPaymentId: paymentId },
          select: { id: true },
        });
        if (existing) {
          await finalizePlanPaymentSuccess(existing.id);
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
