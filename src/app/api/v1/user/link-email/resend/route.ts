import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { issueEmailVerificationToken, sendVerificationEmail } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        purpose: "LINK_EMAIL",
        usedAt: null,
        expiresAt: { gt: new Date() },
        newEmail: { not: null },
        newPasswordHash: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pending || !pending.newEmail || !pending.newPasswordHash) {
      return NextResponse.json({ error: "Нет активной привязки email" }, { status: 404 });
    }

    const issued = await issueEmailVerificationToken({
      userId,
      purpose: "LINK_EMAIL",
      newEmail: pending.newEmail,
      newPasswordHash: pending.newPasswordHash,
    });

    await sendVerificationEmail({
      email: pending.newEmail,
      templateKey: "verify_email_link",
      token: issued.token,
      ttlMinutes: issued.ttlMinutes,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить письмо повторно" }, { status: 500 });
  }
}
