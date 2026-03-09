import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { createInvites } from "@/lib/invite";

type Ctx = { params: Promise<{ id: string }> };
const MAX_ADD_COUNT = 100;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const invites = await prisma.invite.findMany({
    where: {
      scope: "USER",
      ownerUserId: id,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      status: true,
      usedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    invites: invites.map((invite) => {
      const expired = invite.status === "ACTIVE" && invite.expiresAt != null && invite.expiresAt <= new Date();
      const status = expired ? "EXPIRED" : invite.status;
      return {
        id: invite.id,
        code: invite.code,
        status,
        isActive: status === "ACTIVE",
        usedAt: invite.usedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
      };
    }),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const count = Number(body.count);

  if (!Number.isInteger(count) || count < 1 || count > MAX_ADD_COUNT) {
    return NextResponse.json({ error: `Укажите количество от 1 до ${MAX_ADD_COUNT}` }, { status: 400 });
  }

  const userExists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!userExists) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const created = await prisma.$transaction((tx) =>
    createInvites({
      tx,
      scope: "USER",
      count,
      ownerUserId: id,
      createdByUserId: session!.user.id,
    })
  );

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
  });
}
