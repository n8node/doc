import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { InviteStatus, InviteScope, Prisma } from "@prisma/client";

type RegistrationChannel = "EMAIL" | "TELEGRAM" | "BOTH" | null;

function getRegistrationChannel(user: {
  email: string;
  telegramUserId: bigint | null;
} | null): RegistrationChannel {
  if (!user) return null;
  const hasTelegram = user.telegramUserId != null;
  const hasEmail = !user.email.endsWith("@qoqon.placeholder");
  if (hasTelegram && hasEmail) return "BOTH";
  if (hasTelegram) return "TELEGRAM";
  return "EMAIL";
}

function getEffectiveStatus(invite: {
  status: InviteStatus;
  expiresAt: Date | null;
}): InviteStatus {
  if (invite.status === "ACTIVE" && invite.expiresAt && invite.expiresAt <= new Date()) {
    return "EXPIRED";
  }
  return invite.status;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 30)));
  const search = (params.get("search") || "").trim();
  const status = (params.get("status") || "").toUpperCase() as InviteStatus | "";
  const scope = (params.get("scope") || "").toUpperCase() as InviteScope | "";
  const channel = (params.get("channel") || "").toUpperCase() as RegistrationChannel | "";

  const now = new Date();
  const where: Prisma.InviteWhereInput = {};
  const andClauses: Prisma.InviteWhereInput[] = [];

  if (search) {
    andClauses.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { ownerUser: { email: { contains: search, mode: "insensitive" } } },
        { ownerUser: { name: { contains: search, mode: "insensitive" } } },
        { usedByUser: { email: { contains: search, mode: "insensitive" } } },
        { usedByUser: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (scope === "SYSTEM" || scope === "USER") {
    andClauses.push({ scope });
  }

  if (status === "EXPIRED") {
    andClauses.push({
      status: "ACTIVE",
      expiresAt: { lte: now },
    });
  } else if (status === "ACTIVE") {
    andClauses.push({
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
  } else if (status === "USED" || status === "REVOKED") {
    andClauses.push({ status });
  }

  if (channel === "TELEGRAM") {
    andClauses.push({
      usedByUser: {
        telegramUserId: { not: null },
        email: { endsWith: "@qoqon.placeholder" },
      },
    });
  } else if (channel === "EMAIL") {
    andClauses.push({
      usedByUser: {
        telegramUserId: null,
      },
    });
  } else if (channel === "BOTH") {
    andClauses.push({
      usedByUser: {
        telegramUserId: { not: null },
        NOT: { email: { endsWith: "@qoqon.placeholder" } },
      },
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const [invites, total, usedInvites] = await Promise.all([
    prisma.invite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        code: true,
        scope: true,
        status: true,
        createdAt: true,
        usedAt: true,
        expiresAt: true,
        ownerUser: {
          select: { id: true, email: true, name: true, telegramUserId: true, createdAt: true },
        },
        createdByUser: {
          select: { id: true, email: true, name: true },
        },
        usedByUser: {
          select: {
            id: true,
            email: true,
            name: true,
            telegramUserId: true,
            telegramUsername: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.invite.count({ where }),
    prisma.invite.findMany({
      where: {
        status: "USED",
        usedByUserId: { not: null },
        ownerUserId: { not: null },
      },
      orderBy: { usedAt: "desc" },
      take: 500,
      select: {
        id: true,
        code: true,
        usedAt: true,
        ownerUser: {
          select: { id: true, email: true, name: true, telegramUserId: true },
        },
        usedByUser: {
          select: { id: true, email: true, name: true, telegramUserId: true, createdAt: true },
        },
      },
    }),
  ]);

  const mappedInvites = invites.map((invite) => {
    const effectiveStatus = getEffectiveStatus(invite);
    const registrationChannel = getRegistrationChannel(invite.usedByUser);

    return {
      id: invite.id,
      code: invite.code,
      scope: invite.scope,
      status: effectiveStatus,
      createdAt: invite.createdAt.toISOString(),
      usedAt: invite.usedAt?.toISOString() ?? null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      ownerUser: invite.ownerUser
        ? {
            id: invite.ownerUser.id,
            email: invite.ownerUser.email,
            name: invite.ownerUser.name,
          }
        : null,
      createdByUser: invite.createdByUser
        ? {
            id: invite.createdByUser.id,
            email: invite.createdByUser.email,
            name: invite.createdByUser.name,
          }
        : null,
      usedByUser: invite.usedByUser
        ? {
            id: invite.usedByUser.id,
            email: invite.usedByUser.email,
            name: invite.usedByUser.name,
            telegramUsername: invite.usedByUser.telegramUsername,
          }
        : null,
      registrationChannel,
      registrationAt: invite.usedByUser?.createdAt?.toISOString() ?? null,
    };
  });

  const relations = usedInvites.map((invite) => ({
    id: invite.id,
    inviteCode: invite.code,
    inviter: invite.ownerUser
      ? {
          id: invite.ownerUser.id,
          email: invite.ownerUser.email,
          name: invite.ownerUser.name,
        }
      : null,
    invited: invite.usedByUser
      ? {
          id: invite.usedByUser.id,
          email: invite.usedByUser.email,
          name: invite.usedByUser.name,
        }
      : null,
    usedAt: invite.usedAt?.toISOString() ?? null,
    registeredAt: invite.usedByUser?.createdAt.toISOString() ?? null,
    registrationChannel: getRegistrationChannel(invite.usedByUser),
  }));

  return NextResponse.json({
    invites: mappedInvites,
    relations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
