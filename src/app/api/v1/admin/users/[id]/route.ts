import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      blockedAt: true,
      lastLoginAt: true,
      storageUsed: true,
      storageQuota: true,
      maxFileSize: true,
      planId: true,
      plan: { select: { id: true, name: true, isFree: true } },
      createdAt: true,
      updatedAt: true,
      telegramUserId: true,
      telegramUsername: true,
      _count: { select: { files: true, folders: true, shareLinks: true, payments: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const topFiles = await prisma.file.findMany({
    where: { userId: id },
    orderBy: { size: "desc" },
    take: 5,
    select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
  });

  const { _count, ...userData } = user;
  return NextResponse.json({
    ...userData,
    storageUsed: Number(user.storageUsed),
    storageQuota: Number(user.storageQuota),
    maxFileSize: Number(user.maxFileSize),
    telegramUserId: user.telegramUserId != null ? String(user.telegramUserId) : null,
    telegramUsername: user.telegramUsername,
    filesCount: _count.files,
    foldersCount: _count.folders,
    shareLinksCount: _count.shareLinks,
    paymentsCount: _count.payments,
    topFiles: topFiles.map((f) => ({ ...f, size: Number(f.size) })),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  if (id === session?.user?.id) {
    const body = await req.json();
    if (body.role || body.isBlocked !== undefined) {
      return NextResponse.json(
        { error: "Нельзя менять роль или блокировать самого себя" },
        { status: 400 }
      );
    }
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.role === "USER" || body.role === "ADMIN") data.role = body.role;

  if (body.isBlocked === true) {
    data.isBlocked = true;
    data.blockedAt = new Date();
  } else if (body.isBlocked === false) {
    data.isBlocked = false;
    data.blockedAt = null;
  }

  if (body.unlinkTelegram === true) {
    data.telegramUserId = null;
    data.telegramUsername = null;
  }

  if (body.planId !== undefined) {
    if (body.planId === null) {
      data.planId = null;
    } else {
      const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
      if (!plan) {
        return NextResponse.json({ error: "Тариф не найден" }, { status: 404 });
      }
      data.planId = plan.id;
      data.storageQuota = plan.storageQuota;
      data.maxFileSize = plan.maxFileSize;
    }
  }

  if (body.storageQuota != null) {
    data.storageQuota = BigInt(body.storageQuota);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
    storageQuota: Number(user.storageQuota),
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  if (id === session?.user?.id) {
    return NextResponse.json({ error: "Нельзя удалить самого себя" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.shareLink.deleteMany({ where: { createdById: id } }),
    prisma.file.deleteMany({ where: { userId: id } }),
    prisma.folder.deleteMany({ where: { userId: id } }),
    prisma.aiTask.deleteMany({ where: { userId: id } }),
    prisma.payment.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
