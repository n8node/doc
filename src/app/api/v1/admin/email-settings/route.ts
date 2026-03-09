import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getEmailConfig, toBooleanString } from "@/lib/email-config";
import { getEmailTemplate } from "@/lib/email-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cfg, registrationTemplate, linkTemplate] = await Promise.all([
    getEmailConfig(),
    getEmailTemplate("verify_email_registration"),
    getEmailTemplate("verify_email_link"),
  ]);

  return NextResponse.json({
    enabled: cfg.enabled,
    smtpHost: cfg.smtpHost,
    smtpPort: cfg.smtpPort,
    smtpSecure: cfg.smtpSecure,
    smtpUsername: cfg.smtpUsername,
    smtpPasswordSet: !!cfg.smtpPassword,
    smtpFromEmail: cfg.smtpFromEmail,
    smtpFromName: cfg.smtpFromName,
    smtpReplyTo: cfg.smtpReplyTo,
    domain: cfg.domain,
    dkimSelector: cfg.dkimSelector,
    dmarcPolicy: cfg.dmarcPolicy,
    dmarcRua: cfg.dmarcRua,
    templates: {
      verifyRegistration: registrationTemplate,
      verifyLink: linkTemplate,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Promise<void>[] = [];

  const savePlain = (key: string, value: string, description: string) => {
    updates.push(
      configStore.set(key, value, {
        category: "email",
        description,
      })
    );
  };

  if (typeof body.enabled === "boolean") {
    savePlain("email.enabled", toBooleanString(body.enabled), "Глобальное включение email уведомлений");
  }
  if (typeof body.smtpHost === "string") {
    savePlain("email.smtp_host", body.smtpHost.trim(), "SMTP host");
  }
  if (typeof body.smtpPort === "number" && Number.isFinite(body.smtpPort)) {
    savePlain("email.smtp_port", String(Math.max(1, Math.trunc(body.smtpPort))), "SMTP port");
  }
  if (typeof body.smtpSecure === "boolean") {
    savePlain("email.smtp_secure", toBooleanString(body.smtpSecure), "SMTP secure");
  }
  if (typeof body.smtpUsername === "string") {
    savePlain("email.smtp_username", body.smtpUsername.trim(), "SMTP username");
  }
  if (typeof body.smtpFromEmail === "string") {
    savePlain("email.smtp_from_email", body.smtpFromEmail.trim(), "From email");
  }
  if (typeof body.smtpFromName === "string") {
    savePlain("email.smtp_from_name", body.smtpFromName.trim(), "From name");
  }
  if (typeof body.smtpReplyTo === "string") {
    savePlain("email.smtp_reply_to", body.smtpReplyTo.trim(), "Reply-To");
  }
  if (typeof body.domain === "string") {
    savePlain("email.domain", body.domain.trim(), "Mail domain");
  }
  if (typeof body.dkimSelector === "string") {
    savePlain("email.dkim_selector", body.dkimSelector.trim(), "DKIM selector");
  }
  if (body.dmarcPolicy === "none" || body.dmarcPolicy === "quarantine" || body.dmarcPolicy === "reject") {
    savePlain("email.dmarc_policy", body.dmarcPolicy, "DMARC policy");
  }
  if (typeof body.dmarcRua === "string") {
    savePlain("email.dmarc_rua", body.dmarcRua.trim(), "DMARC RUA");
  }

  const smtpPasswordValid =
    body.smtpPassword &&
    typeof body.smtpPassword === "string" &&
    body.smtpPassword.trim() &&
    body.smtpPassword !== "••••••••" &&
    body.smtpPassword !== "********";
  if (smtpPasswordValid) {
    updates.push(
      configStore.set("email.smtp_password", body.smtpPassword.trim(), {
        category: "email",
        description: "SMTP password",
        isEncrypted: true,
      })
    );
  }

  if (typeof body.templates?.verifyRegistration?.subject === "string") {
    savePlain(
      "email.template.verify_email_registration.subject",
      body.templates.verifyRegistration.subject,
      "Email verify template subject (registration)"
    );
  }
  if (typeof body.templates?.verifyRegistration?.html === "string") {
    savePlain(
      "email.template.verify_email_registration.html",
      body.templates.verifyRegistration.html,
      "Email verify template html (registration)"
    );
  }
  if (typeof body.templates?.verifyRegistration?.text === "string") {
    savePlain(
      "email.template.verify_email_registration.text",
      body.templates.verifyRegistration.text,
      "Email verify template text (registration)"
    );
  }
  if (typeof body.templates?.verifyLink?.subject === "string") {
    savePlain(
      "email.template.verify_email_link.subject",
      body.templates.verifyLink.subject,
      "Email verify template subject (link)"
    );
  }
  if (typeof body.templates?.verifyLink?.html === "string") {
    savePlain(
      "email.template.verify_email_link.html",
      body.templates.verifyLink.html,
      "Email verify template html (link)"
    );
  }
  if (typeof body.templates?.verifyLink?.text === "string") {
    savePlain(
      "email.template.verify_email_link.text",
      body.templates.verifyLink.text,
      "Email verify template text (link)"
    );
  }

  await Promise.all(updates);

  [
    "email.enabled",
    "email.smtp_host",
    "email.smtp_port",
    "email.smtp_secure",
    "email.smtp_username",
    "email.smtp_password",
    "email.smtp_from_email",
    "email.smtp_from_name",
    "email.smtp_reply_to",
    "email.domain",
    "email.dkim_selector",
    "email.dmarc_policy",
    "email.dmarc_rua",
    "email.template.verify_email_registration.subject",
    "email.template.verify_email_registration.html",
    "email.template.verify_email_registration.text",
    "email.template.verify_email_link.subject",
    "email.template.verify_email_link.html",
    "email.template.verify_email_link.text",
  ].forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
