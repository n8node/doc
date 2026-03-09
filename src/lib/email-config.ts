import { configStore } from "./config-store";

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: "none" | "ssl" | "tls";
  smtpAutoTls: boolean;
  smtpAuthEnabled: boolean;
  smtpUsername: string;
  smtpPassword: string | null;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpReplyTo: string;
  smtpForceFromEmail: boolean;
  smtpForceFromName: boolean;
  smtpUseFromAsReplyTo: boolean;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const [
    enabled,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpEncryption,
    smtpAutoTls,
    smtpAuthEnabled,
    smtpUsername,
    smtpPassword,
    smtpFromEmail,
    smtpFromName,
    smtpReplyTo,
    smtpForceFromEmail,
    smtpForceFromName,
    smtpUseFromAsReplyTo,
  ] = await Promise.all([
    configStore.get("email.enabled"),
    configStore.get("email.smtp_host"),
    configStore.get("email.smtp_port"),
    configStore.get("email.smtp_secure"),
    configStore.get("email.smtp_encryption"),
    configStore.get("email.smtp_auto_tls"),
    configStore.get("email.smtp_auth_enabled"),
    configStore.get("email.smtp_username"),
    configStore.get("email.smtp_password"),
    configStore.get("email.smtp_from_email"),
    configStore.get("email.smtp_from_name"),
    configStore.get("email.smtp_reply_to"),
    configStore.get("email.smtp_force_from_email"),
    configStore.get("email.smtp_force_from_name"),
    configStore.get("email.smtp_use_from_as_reply_to"),
  ]);

  const legacySecure = smtpSecure === "true";
  const resolvedEncryption =
    smtpEncryption === "none" || smtpEncryption === "ssl" || smtpEncryption === "tls"
      ? smtpEncryption
      : legacySecure
        ? "ssl"
        : "none";

  return {
    enabled: enabled === "true",
    smtpHost: smtpHost || "",
    smtpPort: Number(smtpPort || 587),
    smtpEncryption: resolvedEncryption,
    smtpAutoTls: smtpAutoTls !== "false",
    smtpAuthEnabled: smtpAuthEnabled !== "false",
    smtpUsername: smtpUsername || "",
    smtpPassword: smtpPassword || null,
    smtpFromEmail: smtpFromEmail || "no-reply@qoqon.ru",
    smtpFromName: smtpFromName || "Qoqon",
    smtpReplyTo: smtpReplyTo || "",
    smtpForceFromEmail: smtpForceFromEmail !== "false",
    smtpForceFromName: smtpForceFromName !== "false",
    smtpUseFromAsReplyTo: smtpUseFromAsReplyTo === "true",
  };
}

export function toBooleanString(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}
