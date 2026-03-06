import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  sendTelegramMessage,
  formatRegisterMessage,
} from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email и пароль обязательны" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Некорректный формат email" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 8 символов" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    const freePlan = await prisma.plan.findFirst({ where: { isFree: true } });

    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name?.trim() || null,
        role: "USER",
        planId: freePlan?.id ?? null,
        storageQuota: freePlan?.storageQuota ?? BigInt(25 * 1024 * 1024 * 1024),
        maxFileSize: freePlan?.maxFileSize ?? BigInt(512 * 1024 * 1024),
      },
    });

    try {
      const tg = await getTelegramConfig();
      if (tg.notifyRegisterEnabled && tg.botToken && tg.chatId) {
        const text = formatRegisterMessage(tg.registerMessage, {
          email,
          name: name?.trim() || null,
        });
        await sendTelegramMessage(tg.botToken, tg.chatId, text);
      }
    } catch {
      // ignore telegram errors, do not affect registration
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
