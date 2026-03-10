import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  resolveEmailVerificationToken,
  markEmailVerificationTokenUsed,
} from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token) {
      return NextResponse.json({ error: "Токен обязателен" }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 8 символов" },
        { status: 400 }
      );
    }

    const resolved = await resolveEmailVerificationToken(token);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          error:
            resolved.reason === "TOKEN_EXPIRED"
              ? "Срок действия ссылки истёк. Запросите новую."
              : "Неверная ссылка. Запросите восстановление пароля заново.",
        },
        { status: 400 }
      );
    }

    const row = resolved.tokenRow;
    if (row.purpose !== "PASSWORD_RESET") {
      return NextResponse.json({ error: "Некорректный тип токена" }, { status: 400 });
    }

    const passwordHash = await hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Пароль успешно изменён. Теперь вы можете войти с новым паролем.",
    });
  } catch {
    return NextResponse.json({ error: "Ошибка при смене пароля" }, { status: 500 });
  }
}
