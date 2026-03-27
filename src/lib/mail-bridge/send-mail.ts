import nodemailer from "nodemailer";
import { decryptYandexCredentials } from "@/lib/calendar-bridge/credentials";
import { YANDEX_SMTP_HOST, YANDEX_SMTP_PORT } from "./constants";

export async function sendViaYandexSmtp(params: {
  encryptedCredentials: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const creds = decryptYandexCredentials(params.encryptedCredentials);
  const transporter = nodemailer.createTransport({
    host: YANDEX_SMTP_HOST,
    port: YANDEX_SMTP_PORT,
    secure: true,
    auth: {
      user: creds.login,
      pass: creds.password,
    },
  });

  try {
    await transporter.sendMail({
      from: creds.login,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMTP send failed",
    };
  }
}
