import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const expenses = await prisma.platformExpense.findMany({
    orderBy: { sinceAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      type: e.type,
      amountCents: e.amountCents,
      unit: e.unit,
      sinceAt: e.sinceAt.toISOString(),
      comment: e.comment,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const category = typeof body.category === "string" ? body.category.trim() : "other";
  const type = typeof body.type === "string" ? body.type.trim() : "fixed_monthly";
  const amountCents = typeof body.amountCents === "number" ? body.amountCents : parseInt(String(body.amountCents || 0), 10);
  const unit = typeof body.unit === "string" ? body.unit : null;
  const sinceAt = body.sinceAt ? new Date(body.sinceAt) : new Date();
  const comment = typeof body.comment === "string" ? body.comment : null;

  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return NextResponse.json({ error: "amountCents must be a non-negative number" }, { status: 400 });
  }

  const expense = await prisma.platformExpense.create({
    data: {
      category,
      type,
      amountCents,
      unit,
      sinceAt,
      comment,
    },
  });

  return NextResponse.json({
    id: expense.id,
    category: expense.category,
    type: expense.type,
    amountCents: expense.amountCents,
    unit: expense.unit,
    sinceAt: expense.sinceAt.toISOString(),
    comment: expense.comment,
    createdAt: expense.createdAt.toISOString(),
  });
}
