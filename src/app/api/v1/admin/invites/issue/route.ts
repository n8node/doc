import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { createInvites } from "@/lib/invite";

const MAX_ISSUE_COUNT = 200;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Number(body.count);

  if (!Number.isInteger(count) || count < 1 || count > MAX_ISSUE_COUNT) {
    return NextResponse.json({ error: `Укажите количество от 1 до ${MAX_ISSUE_COUNT}` }, { status: 400 });
  }

  const created = await prisma.$transaction((tx) =>
    createInvites({
      tx,
      scope: "SYSTEM",
      count,
      createdByUserId: session!.user.id,
    })
  );

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    invites: created.map((invite) => ({
      id: invite.id,
      code: invite.code,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
    })),
  });
}
