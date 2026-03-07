import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

/**
 * POST /api/v1/user/link-email
 * Link email to Telegram-only account. Requires session.
 * Body: { email, password } - password for the new email login (user creates it).
 *
 * REMINDER: Add email verification flow! User must confirm email before it becomes active.
 * Send verification link to email, require click before updating user.email.
 * For now we save email and set password without verification.
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

    const passwordHash = await hash(password, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: emailTrimmed,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
