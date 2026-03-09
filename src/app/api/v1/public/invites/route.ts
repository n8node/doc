import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const invites = await prisma.invite.findMany({
    where: { scope: "SYSTEM" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      status: true,
      usedAt: true,
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
      };
    }),
  });
}
