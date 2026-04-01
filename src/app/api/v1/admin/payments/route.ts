import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { PaymentStatus, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));
  const status = url.searchParams.get("status") || "";
  const userSearch = url.searchParams.get("user")?.trim() || "";
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const where: Prisma.PaymentWhereInput = {};

  if (status) {
    const statuses = status.split(",").filter((s) => ["succeeded", "pending", "canceled", "refunded"].includes(s));
    if (statuses.length === 1) {
      where.status = statuses[0] as PaymentStatus;
    } else if (statuses.length > 1) {
      where.status = { in: statuses as PaymentStatus[] };
    }
  }
  if (userSearch) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: userSearch, mode: "insensitive" } },
          { name: { contains: userSearch, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      where.userId = { in: userIds };
    } else {
      where.userId = "nonexistent-id-to-match-nothing";
    }
  }
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!isNaN(d.getTime())) {
      where.createdAt = where.createdAt || {};
      (where.createdAt as Prisma.DateTimeFilter).gte = d;
    }
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      where.createdAt = where.createdAt || {};
      (where.createdAt as Prisma.DateTimeFilter).lte = d;
    }
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      yookassaPaymentId: p.yookassaPaymentId,
      paymentProvider: p.paymentProvider,
      robokassaInvId: p.robokassaInvId,
      user: p.user,
      plan: p.plan,
    })),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  });
}
