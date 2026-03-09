import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { sendEmail } from "@/lib/email-sender";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim() : "";
    if (!toEmail) {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const sent = await sendEmail({
      to: toEmail,
      subject: "Тест SMTP из админки Qoqon",
      html: "<p>Тестовое письмо отправлено успешно.</p>",
      text: "Тестовое письмо отправлено успешно.",
    });

    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || "Не удалось отправить письмо" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка тестовой отправки" }, { status: 500 });
  }
}
