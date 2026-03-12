import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const search = url.searchParams.get("search")?.trim() || "";
  const role = url.searchParams.get("role") || "";
  const planId = url.searchParams.get("planId") || "";
  const sort = url.searchParams.get("sort") || "createdAt";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const blocked = url.searchParams.get("blocked");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role === "USER" || role === "ADMIN") where.role = role;
  if (planId) where.planId = planId === "none" ? null : planId;
  if (blocked === "true") where.isBlocked = true;
  if (blocked === "false") where.isBlocked = false;

  const allowedSorts: Record<string, string> = {
    createdAt: "createdAt",
    email: "email",
    storageUsed: "storageUsed",
    lastLoginAt: "lastLoginAt",
  };
  const sortField = allowedSorts[sort] || "createdAt";

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBlocked: true,
        lastLoginAt: true,
        storageUsed: true,
        storageQuota: true,
        planId: true,
        plan: { select: { id: true, name: true, isFree: true } },
        createdAt: true,
        telegramUserId: true,
        telegramUsername: true,
        _count: { select: { files: true, folders: true } },
      },
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isBlocked: u.isBlocked,
      lastLoginAt: u.lastLoginAt,
      storageUsed: Number(u.storageUsed),
      storageQuota: Number(u.storageQuota),
      plan: u.plan
        ? { id: u.plan.id, name: u.plan.name, isFree: u.plan.isFree }
        : null,
      filesCount: u._count.files,
      foldersCount: u._count.folders,
      createdAt: u.createdAt,
      telegramUserId: u.telegramUserId != null ? String(u.telegramUserId) : null,
      telegramUsername: u.telegramUsername,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
