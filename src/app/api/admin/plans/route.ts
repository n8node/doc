import { NextResponse } from "next/server";
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
  const plans = await prisma.plan.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      storageQuota: Number(p.storageQuota),
      maxFileSize: Number(p.maxFileSize),
    })),
  });
}
