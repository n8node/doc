"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TemplateState = {
  subject: string;
  html: string;
  text: string;
};

export function EmailSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [values, setValues] = useState({
    enabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: "",
    smtpPassword: "",
    smtpPasswordSet: false,
    smtpFromEmail: "no-reply@qoqon.ru",
    smtpFromName: "Qoqon",
    smtpReplyTo: "",
    domain: "qoqon.ru",
    dkimSelector: "mail",
    dmarcPolicy: "none" as "none" | "quarantine" | "reject",
    dmarcRua: "",
    templates: {
      verifyRegistration: {
        subject: "",
        html: "",
        text: "",
      } as TemplateState,
      verifyLink: {
        subject: "",
        html: "",
        text: "",
      } as TemplateState,
    },
  });

  useEffect(() => {
    fetch("/api/v1/admin/email-settings")
      .then((r) => r.json())
      .then((data) => {
        setValues((prev) => ({
          ...prev,
          enabled: data.enabled === true,
          smtpHost: data.smtpHost || "",
          smtpPort: Number(data.smtpPort || 587),
          smtpSecure: data.smtpSecure === true,
          smtpUsername: data.smtpUsername || "",
          smtpPassword: "",
          smtpPasswordSet: data.smtpPasswordSet === true,
          smtpFromEmail: data.smtpFromEmail || prev.smtpFromEmail,
          smtpFromName: data.smtpFromName || prev.smtpFromName,
          smtpReplyTo: data.smtpReplyTo || "",
          domain: data.domain || prev.domain,
          dkimSelector: data.dkimSelector || prev.dkimSelector,
          dmarcPolicy:
            data.dmarcPolicy === "quarantine" || data.dmarcPolicy === "reject" ? data.dmarcPolicy : "none",
          dmarcRua: data.dmarcRua || "",
          templates: {
            verifyRegistration: {
              subject: data.templates?.verifyRegistration?.subject || "",
              html: data.templates?.verifyRegistration?.html || "",
              text: data.templates?.verifyRegistration?.text || "",
            },
            verifyLink: {
              subject: data.templates?.verifyLink?.subject || "",
              html: data.templates?.verifyLink?.html || "",
              text: data.templates?.verifyLink?.text || "",
            },
          },
        }));
      })
      .catch(() => toast.error("Не удалось загрузить email-настройки"))
      .finally(() => setLoading(false));
  }, []);

  const dkimRecord = useMemo(
    () =>
      `${values.dkimSelector}._domainkey.${values.domain} IN TXT "v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>"`,
    [values.dkimSelector, values.domain]
  );
  const dmarcRecord = useMemo(() => {
    const rua = values.dmarcRua ? `; rua=mailto:${values.dmarcRua}` : "";
    return `_dmarc.${values.domain} IN TXT "v=DMARC1; p=${values.dmarcPolicy}${rua}"`;
  }, [values.domain, values.dmarcPolicy, values.dmarcRua]);
  const spfRecord = useMemo(
    () => `${values.domain} IN TXT "v=spf1 mx a ~all"`,
    [values.domain]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          smtpPassword: values.smtpPassword || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Email-настройки сохранены");
      setValues((prev) => ({ ...prev, smtpPassword: "", smtpPasswordSet: prev.smtpPasswordSet || true }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      toast.error("Укажите email для теста");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/v1/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      toast.success("Тестовое письмо отправлено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка email-настроек...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Email / SMTP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Глобальная настройка почты, DNS-политик и шаблонов системных писем
        </p>
      </div>

      <div className="space-y-6">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm">Включить отправку email в системе</span>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP host</label>
            <Input
              value={values.smtpHost}
              onChange={(e) => setValues((v) => ({ ...v, smtpHost: e.target.value }))}
              placeholder="smtp.example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP port</label>
            <Input
              type="number"
              min={1}
              value={values.smtpPort}
              onChange={(e) => setValues((v) => ({ ...v, smtpPort: Number(e.target.value || 587) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP username</label>
            <Input
              value={values.smtpUsername}
              onChange={(e) => setValues((v) => ({ ...v, smtpUsername: e.target.value }))}
              placeholder="smtp-user"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP password</label>
            <Input
              type="password"
              value={values.smtpPassword}
              onChange={(e) => setValues((v) => ({ ...v, smtpPassword: e.target.value }))}
              placeholder={values.smtpPasswordSet ? "•••••••• (сохранён)" : "Введите пароль"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">From email</label>
            <Input
              value={values.smtpFromEmail}
              onChange={(e) => setValues((v) => ({ ...v, smtpFromEmail: e.target.value }))}
              placeholder="no-reply@domain.tld"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">From name</label>
            <Input
              value={values.smtpFromName}
              onChange={(e) => setValues((v) => ({ ...v, smtpFromName: e.target.value }))}
              placeholder="Qoqon"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Reply-To</label>
            <Input
              value={values.smtpReplyTo}
              onChange={(e) => setValues((v) => ({ ...v, smtpReplyTo: e.target.value }))}
              placeholder="support@domain.tld"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={values.smtpSecure}
                onChange={(e) => setValues((v) => ({ ...v, smtpSecure: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Использовать SMTPS (secure)</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">DNS домен и DMARC</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Домен</label>
              <Input
                value={values.domain}
                onChange={(e) => setValues((v) => ({ ...v, domain: e.target.value }))}
                placeholder="qoqon.ru"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">DKIM selector</label>
              <Input
                value={values.dkimSelector}
                onChange={(e) => setValues((v) => ({ ...v, dkimSelector: e.target.value }))}
                placeholder="mail"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">DMARC policy</label>
              <select
                value={values.dmarcPolicy}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    dmarcPolicy: e.target.value as "none" | "quarantine" | "reject",
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="none">none</option>
                <option value="quarantine">quarantine</option>
                <option value="reject">reject</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">DMARC rua (email)</label>
              <Input
                value={values.dmarcRua}
                onChange={(e) => setValues((v) => ({ ...v, dmarcRua: e.target.value }))}
                placeholder="postmaster@qoqon.ru"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>SPF: <span className="font-mono">{spfRecord}</span></p>
            <p>DKIM: <span className="font-mono">{dkimRecord}</span></p>
            <p>DMARC: <span className="font-mono">{dmarcRecord}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Шаблон: подтверждение регистрации</h3>
          <Input
            value={values.templates.verifyRegistration.subject}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyRegistration: { ...v.templates.verifyRegistration, subject: e.target.value },
                },
              }))
            }
            placeholder="Тема письма"
          />
          <textarea
            value={values.templates.verifyRegistration.html}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyRegistration: { ...v.templates.verifyRegistration, html: e.target.value },
                },
              }))
            }
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={values.templates.verifyRegistration.text}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyRegistration: { ...v.templates.verifyRegistration, text: e.target.value },
                },
              }))
            }
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Шаблон: подтверждение привязки email</h3>
          <Input
            value={values.templates.verifyLink.subject}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyLink: { ...v.templates.verifyLink, subject: e.target.value },
                },
              }))
            }
            placeholder="Тема письма"
          />
          <textarea
            value={values.templates.verifyLink.html}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyLink: { ...v.templates.verifyLink, html: e.target.value },
                },
              }))
            }
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={values.templates.verifyLink.text}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                templates: {
                  ...v.templates,
                  verifyLink: { ...v.templates.verifyLink, text: e.target.value },
                },
              }))
            }
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Тестовая отправка
        </p>
        <div className="flex max-w-xl gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="email для тестовой отправки"
          />
          <Button variant="outline" onClick={handleTestSend} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сохранить email-настройки
      </Button>
    </div>
  );
}
