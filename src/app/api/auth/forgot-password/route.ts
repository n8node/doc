import { NextRequest, NextResponse } from "next/server";
import { issuePasswordResetAndSendEmail } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Укажите email" }, { status: 400 });
    }

    const result = await issuePasswordResetAndSendEmail({ email });
    if (!result.ok && result.error === "EMAIL_DISABLED") {
      return NextResponse.json(
        { error: "Отправка писем отключена. Обратитесь к администратору." },
        { status: 503 }
      );
    }
    if (!result.ok && result.error === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Почтовый сервер не настроен. Обратитесь к администратору." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Если аккаунт с таким email существует, на него отправлена ссылка для восстановления пароля.",
    });
  } catch {
    return NextResponse.json({ error: "Ошибка при отправке письма" }, { status: 500 });
  }
}
