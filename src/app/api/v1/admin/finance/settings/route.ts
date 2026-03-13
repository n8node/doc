import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getFinanceSettings,
  setFinanceSettings,
  type PaymentCommissionPayer,
} from "@/lib/finance/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await getFinanceSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const settings: Partial<{
    taxRatePct: number;
    paymentCommissionPct: number;
    paymentCommissionPayer: PaymentCommissionPayer;
    fxBufferPct: number;
    s3CostPerGbDayCents: number;
    s3MarkupPct: number;
    defaultTokenMarkupPct: number;
  }> = {};

  if (typeof body.taxRatePct === "number") settings.taxRatePct = body.taxRatePct;
  if (typeof body.paymentCommissionPct === "number")
    settings.paymentCommissionPct = body.paymentCommissionPct;
  if (body.paymentCommissionPayer === "user" || body.paymentCommissionPayer === "platform")
    settings.paymentCommissionPayer = body.paymentCommissionPayer;
  if (typeof body.fxBufferPct === "number") settings.fxBufferPct = body.fxBufferPct;
  if (typeof body.s3CostPerGbDayCents === "number")
    settings.s3CostPerGbDayCents = body.s3CostPerGbDayCents;
  if (typeof body.s3MarkupPct === "number") settings.s3MarkupPct = body.s3MarkupPct;
  if (typeof body.defaultTokenMarkupPct === "number")
    settings.defaultTokenMarkupPct = body.defaultTokenMarkupPct;

  await setFinanceSettings(settings);
  return NextResponse.json({ ok: true });
}
