import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      storageUsed: true,
      storageQuota: true,
      maxFileSize: true,
      planId: true,
      plan: {
        select: {
          id: true,
          name: true,
          isFree: true,
          storageQuota: true,
        },
      },
      _count: { select: { files: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentQuota = user.plan ? user.plan.storageQuota : user.storageQuota;

  const nextPlan = await prisma.plan.findFirst({
    where: {
      storageQuota: { gt: currentQuota },
      id: user.planId ? { not: user.planId } : undefined,
    },
    orderBy: { storageQuota: "asc" },
    select: {
      id: true,
      name: true,
      priceMonthly: true,
      storageQuota: true,
    },
  });

  return NextResponse.json({
    storageUsed: Number(user.storageUsed),
    storageQuota: Number(user.storageQuota),
    maxFileSize: Number(user.maxFileSize),
    filesCount: user._count.files,
    plan: user.plan
      ? {
          id: user.plan.id,
          name: user.plan.name,
          isFree: user.plan.isFree,
        }
      : {
          id: "free",
          name: "Бесплатный",
          isFree: true,
        },
    nextPlan: nextPlan
      ? {
          id: nextPlan.id,
          name: nextPlan.name,
          priceMonthly: nextPlan.priceMonthly,
          storageQuota: Number(nextPlan.storageQuota),
        }
      : null,
  });
}
