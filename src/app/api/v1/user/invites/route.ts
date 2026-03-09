import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { isInviteRegistrationEnabled } from "@/lib/invite";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isInviteRegistrationEnabled();
  if (!enabled) {
    return NextResponse.json({ inviteRegistrationEnabled: false, invites: [] });
  }

  const invites = await prisma.invite.findMany({
    where: {
      scope: "USER",
      ownerUserId: userId,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      status: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    inviteRegistrationEnabled: true,
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
