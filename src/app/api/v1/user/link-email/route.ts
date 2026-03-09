import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { issueEmailVerificationToken, sendVerificationEmail } from "@/lib/email-verification";

/**
 * POST /api/v1/user/link-email
 * Link email to Telegram-only account. Requires session.
 * Body: { email, password } - password for the new email login (user creates it).
 * Flow: issue verification token and apply email/password only after confirmation.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return NextResponse.json({ error: "Некорректный формат email" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Пароль обязателен, не менее 8 символов" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.email.endsWith("@qoqon.placeholder")) {
      return NextResponse.json(
        { error: "У вашего аккаунта уже есть email" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailTrimmed },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Этот email уже используется другим аккаунтом" },
        { status: 409 }
      );
    }

    const activeForAnotherUser = await prisma.emailVerificationToken.findFirst({
      where: {
        newEmail: emailTrimmed,
        usedAt: null,
        expiresAt: { gt: new Date() },
        userId: { not: userId },
      },
      select: { id: true },
    });
    if (activeForAnotherUser) {
      return NextResponse.json(
        { error: "Этот email уже ожидает подтверждения в другом аккаунте" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const issued = await issueEmailVerificationToken({
      userId,
      purpose: "LINK_EMAIL",
      newEmail: emailTrimmed,
      newPasswordHash: passwordHash,
    });
    const sent = await sendVerificationEmail({
      email: emailTrimmed,
      templateKey: "verify_email_link",
      token: issued.token,
      ttlMinutes: issued.ttlMinutes,
    });

    return NextResponse.json({
      ok: true,
      pendingVerification: true,
      verificationEmailSent: sent.ok,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
