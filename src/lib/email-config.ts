import { configStore } from "./config-store";

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string | null;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpReplyTo: string;
  domain: string;
  dkimSelector: string;
  dmarcPolicy: "none" | "quarantine" | "reject";
  dmarcRua: string;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const [
    enabled,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUsername,
    smtpPassword,
    smtpFromEmail,
    smtpFromName,
    smtpReplyTo,
    domain,
    dkimSelector,
    dmarcPolicy,
    dmarcRua,
  ] = await Promise.all([
    configStore.get("email.enabled"),
    configStore.get("email.smtp_host"),
    configStore.get("email.smtp_port"),
    configStore.get("email.smtp_secure"),
    configStore.get("email.smtp_username"),
    configStore.get("email.smtp_password"),
    configStore.get("email.smtp_from_email"),
    configStore.get("email.smtp_from_name"),
    configStore.get("email.smtp_reply_to"),
    configStore.get("email.domain"),
    configStore.get("email.dkim_selector"),
    configStore.get("email.dmarc_policy"),
    configStore.get("email.dmarc_rua"),
  ]);

  return {
    enabled: enabled === "true",
    smtpHost: smtpHost || "",
    smtpPort: Number(smtpPort || 587),
    smtpSecure: smtpSecure === "true",
    smtpUsername: smtpUsername || "",
    smtpPassword: smtpPassword || null,
    smtpFromEmail: smtpFromEmail || "no-reply@qoqon.ru",
    smtpFromName: smtpFromName || "Qoqon",
    smtpReplyTo: smtpReplyTo || "",
    domain: domain || "qoqon.ru",
    dkimSelector: dkimSelector || "mail",
    dmarcPolicy:
      dmarcPolicy === "reject" || dmarcPolicy === "quarantine" ? dmarcPolicy : "none",
    dmarcRua: dmarcRua || "",
  };
}

export function toBooleanString(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}
