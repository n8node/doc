import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  sendTelegramMessage,
  formatRegisterMessage,
} from "@/lib/telegram";
import { getAuthSettings } from "@/lib/telegram-auth";
import { consumeActiveInvite, createInvites, isInviteCodeFormatValid, normalizeInviteCode } from "@/lib/invite";
import { issueEmailVerificationToken, sendVerificationEmail } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.emailRegistrationEnabled) {
      return NextResponse.json({ error: "Регистрация по email отключена" }, { status: 403 });
    }
    const { email, password, name, inviteCode } = await req.json();

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
    const normalizedInviteCode = normalizeInviteCode(String(inviteCode ?? ""));

    if (authSettings.inviteRegistrationEnabled) {
      if (!isInviteCodeFormatValid(normalizedInviteCode)) {
        return NextResponse.json(
          { error: "Для регистрации требуется валидный инвайт-ключ" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(password, 12);
    let createdUserId = "";
    await prisma.$transaction(async (tx) => {
      let consumedInviteId: string | null = null;

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: name?.trim() || null,
          isEmailVerified: authSettings.emailVerificationRequired ? false : true,
          emailVerifiedAt: authSettings.emailVerificationRequired ? null : new Date(),
          role: "USER",
          planId: freePlan?.id ?? null,
          storageQuota: freePlan?.storageQuota ?? BigInt(25 * 1024 * 1024 * 1024),
          maxFileSize: freePlan?.maxFileSize ?? BigInt(512 * 1024 * 1024),
        },
      });
      createdUserId = user.id;

      if (authSettings.inviteRegistrationEnabled) {
        const invite = await consumeActiveInvite({
          tx,
          code: normalizedInviteCode,
          usedByUserId: user.id,
        });
        consumedInviteId = invite.id;

        await createInvites({
          tx,
          scope: "USER",
          count: 3,
          ownerUserId: user.id,
          createdByUserId: user.id,
        });
      }

      if (consumedInviteId) {
        await tx.user.update({
          where: { id: user.id },
          data: { registeredViaInviteId: consumedInviteId },
        });
      }
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

    let verificationEmailSent = false;
    if (authSettings.emailVerificationRequired && createdUserId) {
      const issued = await issueEmailVerificationToken({
        userId: createdUserId,
        purpose: "REGISTER",
      });
      const sent = await sendVerificationEmail({
        email,
        templateKey: "verify_email_registration",
        token: issued.token,
        ttlMinutes: issued.ttlMinutes,
      });
      verificationEmailSent = sent.ok;
    }

    return NextResponse.json({
      ok: true,
      requiresEmailVerification: authSettings.emailVerificationRequired,
      verificationEmailSent,
    });
  } catch (error) {
    if (error instanceof Error && (
      error.message === "INVITE_NOT_ACTIVE" ||
      error.message === "INVITE_ALREADY_CONSUMED" ||
      error.message === "INVALID_INVITE_CODE"
    )) {
      return NextResponse.json(
        { error: "Инвайт-ключ недействителен или уже использован" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
