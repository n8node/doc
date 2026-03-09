import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getEmailConfig, toBooleanString } from "@/lib/email-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = await getEmailConfig();

  return NextResponse.json({
    enabled: cfg.enabled,
    smtpHost: cfg.smtpHost,
    smtpPort: cfg.smtpPort,
    smtpEncryption: cfg.smtpEncryption,
    smtpAutoTls: cfg.smtpAutoTls,
    smtpAuthEnabled: cfg.smtpAuthEnabled,
    smtpUsername: cfg.smtpUsername,
    smtpPasswordSet: !!cfg.smtpPassword,
    smtpFromEmail: cfg.smtpFromEmail,
    smtpFromName: cfg.smtpFromName,
    smtpReplyTo: cfg.smtpReplyTo,
    smtpForceFromEmail: cfg.smtpForceFromEmail,
    smtpForceFromName: cfg.smtpForceFromName,
    smtpUseFromAsReplyTo: cfg.smtpUseFromAsReplyTo,
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
  if (body.smtpEncryption === "none" || body.smtpEncryption === "ssl" || body.smtpEncryption === "tls") {
    savePlain("email.smtp_encryption", body.smtpEncryption, "SMTP encryption");
    savePlain("email.smtp_secure", toBooleanString(body.smtpEncryption === "ssl"), "SMTP secure (legacy)");
  }
  if (typeof body.smtpAutoTls === "boolean") {
    savePlain("email.smtp_auto_tls", toBooleanString(body.smtpAutoTls), "SMTP auto TLS");
  }
  if (typeof body.smtpAuthEnabled === "boolean") {
    savePlain("email.smtp_auth_enabled", toBooleanString(body.smtpAuthEnabled), "SMTP auth enabled");
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
  if (typeof body.smtpForceFromEmail === "boolean") {
    savePlain("email.smtp_force_from_email", toBooleanString(body.smtpForceFromEmail), "Always use from email");
  }
  if (typeof body.smtpForceFromName === "boolean") {
    savePlain("email.smtp_force_from_name", toBooleanString(body.smtpForceFromName), "Always use from name");
  }
  if (typeof body.smtpUseFromAsReplyTo === "boolean") {
    savePlain("email.smtp_use_from_as_reply_to", toBooleanString(body.smtpUseFromAsReplyTo), "Use from email as reply-to");
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

  await Promise.all(updates);

  [
    "email.enabled",
    "email.smtp_host",
    "email.smtp_port",
    "email.smtp_encryption",
    "email.smtp_auto_tls",
    "email.smtp_auth_enabled",
    "email.smtp_secure",
    "email.smtp_username",
    "email.smtp_password",
    "email.smtp_from_email",
    "email.smtp_from_name",
    "email.smtp_reply_to",
    "email.smtp_force_from_email",
    "email.smtp_force_from_name",
    "email.smtp_use_from_as_reply_to",
  ].forEach((k) => configStore.invalidate(k));

  return NextResponse.json({ ok: true });
}
