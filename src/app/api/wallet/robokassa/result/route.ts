import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRobokassaConfig,
  robokassaCollectShpForResult,
  robokassaOutSumToCents,
  robokassaResultSignature,
  robokassaSignaturesEqual,
} from "@/lib/robokassa";
import {
  finalizeLlmWalletTopupSuccess,
  finalizePlanPaymentSuccess,
} from "@/lib/payment-completion";

async function readRobokassaParams(req: NextRequest): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  req.nextUrl.searchParams.forEach((v, k) => {
    m.set(k, v);
  });
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      try {
        const fd = await req.formData();
        for (const [k, v] of Array.from(fd.entries())) {
          if (typeof v === "string") {
            m.set(k, v);
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return m;
}

function textResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Result URL Robokassa: подтверждение оплаты (сервер-сервер).
 * В личном кабинете Robokassa укажите этот адрес.
 * Ответ при успехе: OK{InvId}
 */
export async function GET(req: NextRequest) {
  return handleRobokassaResult(req);
}

export async function POST(req: NextRequest) {
  return handleRobokassaResult(req);
}

async function handleRobokassaResult(req: NextRequest) {
  const params = await readRobokassaParams(req);
  const get = (keys: string[]) => {
    for (const k of keys) {
      const v = params.get(k);
      if (v != null && v !== "") return v;
    }
    return "";
  };

  const outSum = get(["OutSum", "out_summ", "Outsumm"]);
  const invIdRaw = get(["InvId", "InvID", "inv_id"]);
  const signatureReceived = get(["SignatureValue", "crc", "CRC"]);

  if (!outSum || !invIdRaw || !signatureReceived) {
    return textResponse("bad params", 400);
  }

  const invIdNum = Number.parseInt(String(invIdRaw), 10);
  if (!Number.isFinite(invIdNum) || invIdNum < 1) {
    return textResponse("bad inv", 400);
  }

  const cfg = await getRobokassaConfig();
  if (!cfg) {
    return textResponse("config", 503);
  }

  const shpParts = robokassaCollectShpForResult(Array.from(params.entries()));
  const expectedSig = robokassaResultSignature({
    outSum,
    invId: String(invIdRaw).trim(),
    password2: cfg.password2,
    shpSorted: shpParts,
  });

  if (!robokassaSignaturesEqual(expectedSig, signatureReceived)) {
    return textResponse("bad sign", 400);
  }

  const topup = await prisma.llmWalletTopup.findUnique({
    where: { robokassaInvId: invIdNum },
    select: {
      id: true,
      status: true,
      amountCents: true,
      paymentProvider: true,
    },
  });

  if (topup) {
    if (topup.paymentProvider && topup.paymentProvider !== "robokassa") {
      return textResponse("bad provider", 400);
    }
    const gotCents = robokassaOutSumToCents(outSum);
    if (gotCents < 0 || gotCents !== topup.amountCents) {
      return textResponse("bad amount", 400);
    }
    if (topup.status === "pending") {
      await finalizeLlmWalletTopupSuccess(topup.id);
    }
    return textResponse(`OK${invIdNum}`, 200);
  }

  const payment = await prisma.payment.findUnique({
    where: { robokassaInvId: invIdNum },
    select: {
      id: true,
      status: true,
      amount: true,
      paymentProvider: true,
    },
  });

  if (!payment) {
    return textResponse("unknown inv", 404);
  }

  if (payment.paymentProvider && payment.paymentProvider !== "robokassa") {
    return textResponse("bad provider", 400);
  }

  const expectedCents = payment.amount * 100;
  const gotCents = robokassaOutSumToCents(outSum);
  if (gotCents < 0 || gotCents !== expectedCents) {
    return textResponse("bad amount", 400);
  }

  if (payment.status === "pending") {
    await finalizePlanPaymentSuccess(payment.id);
  }

  return textResponse(`OK${invIdNum}`, 200);
}
