import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markEmailVerificationTokenUsed, resolveEmailVerificationToken } from "@/lib/email-verification";
import { createTelegramSessionToken } from "@/lib/telegram-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Токен обязателен" }, { status: 400 });
    }

    const resolved = await resolveEmailVerificationToken(token);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.reason === "TOKEN_EXPIRED" ? "Срок действия ссылки истёк" : "Неверная ссылка" },
        { status: 400 }
      );
    }

    const row = resolved.tokenRow;
    if (row.purpose === "REGISTER") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: row.userId },
          data: {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        }),
        prisma.emailVerificationToken.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        }),
      ]);
      return NextResponse.json({
        ok: true,
        mode: "register",
        sessionToken: createTelegramSessionToken(row.userId),
      });
    }

    if (row.purpose === "LINK_EMAIL") {
      if (!row.newEmail || !row.newPasswordHash) {
        return NextResponse.json({ error: "Некорректные данные подтверждения" }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email: row.newEmail } });
      if (existing && existing.id !== row.userId) {
        return NextResponse.json({ error: "Этот email уже занят" }, { status: 409 });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: row.userId },
          data: {
            email: row.newEmail,
            passwordHash: row.newPasswordHash,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        }),
        prisma.emailVerificationToken.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        }),
      ]);
      return NextResponse.json({
        ok: true,
        mode: "link_email",
        sessionToken: createTelegramSessionToken(row.userId),
      });
    }

    await markEmailVerificationTokenUsed(row.id);
    return NextResponse.json({ error: "Неподдерживаемый тип подтверждения" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка подтверждения email" }, { status: 500 });
  }
}
