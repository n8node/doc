import { configStore } from "./config-store";

export type EmailTemplateKey = "verify_email_registration" | "verify_email_link" | "password_reset";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  verify_email_registration: {
    subject: "Подтвердите регистрацию в Qoqon",
    html: `<p>Здравствуйте!</p><p>Нажмите на ссылку, чтобы подтвердить email:</p><p><a href="{verifyLink}">{verifyLink}</a></p><p>Ссылка действует {expiresMinutes} минут.</p>`,
    text: `Здравствуйте!\n\nПодтвердите email по ссылке:\n{verifyLink}\n\nСсылка действует {expiresMinutes} минут.`,
  },
  verify_email_link: {
    subject: "Подтвердите привязку email в Qoqon",
    html: `<p>Здравствуйте!</p><p>Нажмите на ссылку, чтобы завершить привязку email к аккаунту:</p><p><a href="{verifyLink}">{verifyLink}</a></p><p>Ссылка действует {expiresMinutes} минут.</p>`,
    text: `Здравствуйте!\n\nПодтвердите привязку email по ссылке:\n{verifyLink}\n\nСсылка действует {expiresMinutes} минут.`,
  },
  password_reset: {
    subject: "Восстановление пароля — Qoqon",
    html: `<p>Здравствуйте!</p><p>Вы запросили восстановление пароля. Нажмите на ссылку, чтобы задать новый пароль:</p><p><a href="{resetLink}">{resetLink}</a></p><p>Ссылка действует {expiresMinutes} минут.</p><p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>`,
    text: `Здравствуйте!\n\nВы запросили восстановление пароля. Перейдите по ссылке, чтобы задать новый пароль:\n{resetLink}\n\nСсылка действует {expiresMinutes} минут.\n\nЕсли вы не запрашивали восстановление пароля, проигнорируйте это письмо.`,
  },
};

export async function getEmailTemplate(templateKey: EmailTemplateKey): Promise<EmailTemplate> {
  const [subject, html, text] = await Promise.all([
    configStore.get(`email.template.${templateKey}.subject`),
    configStore.get(`email.template.${templateKey}.html`),
    configStore.get(`email.template.${templateKey}.text`),
  ]);

  const defaults = DEFAULT_TEMPLATES[templateKey];
  return {
    subject: subject || defaults.subject,
    html: html || defaults.html,
    text: text || defaults.text,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => {
    return acc.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }, template);
}
