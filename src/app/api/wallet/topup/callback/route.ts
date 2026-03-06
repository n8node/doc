import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      }
    }

    if (event === "payment.canceled" && paymentId) {
      await prisma.payment.updateMany({
        where: { yookassaPaymentId: paymentId },
        data: { status: "canceled" },
      });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 200 });
  }
}
