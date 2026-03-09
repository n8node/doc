import nodemailer from "nodemailer";
import { getEmailConfig } from "./email-config";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getEmailConfig();
  if (!cfg.enabled) {
    return { ok: false, error: "EMAIL_DISABLED" };
  }
  if (!cfg.smtpHost || !cfg.smtpUsername || !cfg.smtpPassword) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: {
        user: cfg.smtpUsername,
        pass: cfg.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: cfg.smtpFromName
        ? `"${cfg.smtpFromName}" <${cfg.smtpFromEmail}>`
        : cfg.smtpFromEmail,
      to: params.to,
      replyTo: cfg.smtpReplyTo || undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "EMAIL_SEND_FAILED",
    };
  }
}
