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
      registeredViaInvite: {
        select: {
          id: true,
          code: true,
          ownerUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const invitedUsers = await prisma.user.findMany({
    where: {
      registeredViaInvite: {
        ownerUserId: id,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      registeredViaInvite: {
        select: {
          id: true,
          code: true,
        },
      },
    },
  });

  return NextResponse.json({
    invitedBy: user.registeredViaInvite
      ? {
          inviteId: user.registeredViaInvite.id,
          inviteCode: user.registeredViaInvite.code,
          user: user.registeredViaInvite.ownerUser
            ? {
                id: user.registeredViaInvite.ownerUser.id,
                email: user.registeredViaInvite.ownerUser.email,
                name: user.registeredViaInvite.ownerUser.name,
              }
            : null,
        }
      : null,
    invitedUsers: invitedUsers.map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      inviteCode: item.registeredViaInvite?.code ?? null,
      registeredAt: item.createdAt.toISOString(),
    })),
  });
}
