import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, isFree, storageQuota, features, priceMonthly, priceYearly } = body;
  const data: Record<string, unknown> = {};
  if (name != null) data.name = name;
  if (isFree != null) data.isFree = !!isFree;
  if (storageQuota != null) data.storageQuota = BigInt(storageQuota);
  if (features != null) data.features = features;
  if (priceMonthly != null) data.priceMonthly = priceMonthly;
  if (priceYearly != null) data.priceYearly = priceYearly;
  const plan = await prisma.plan.update({
    where: { id },
    data,
  });
  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
  });
}
