import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueEmailVerificationToken, sendVerificationEmail } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isEmailVerified) {
      return NextResponse.json({ ok: true });
    }

    const issued = await issueEmailVerificationToken({
      userId: user.id,
      purpose: "REGISTER",
    });
    await sendVerificationEmail({
      email: user.email,
      templateKey: "verify_email_registration",
      token: issued.token,
      ttlMinutes: issued.ttlMinutes,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить письмо повторно" }, { status: 500 });
  }
}
