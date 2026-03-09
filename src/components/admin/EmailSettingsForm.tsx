"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EmailSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [values, setValues] = useState({
    enabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpEncryption: "none" as "none" | "ssl" | "tls",
    smtpAutoTls: true,
    smtpAuthEnabled: true,
    smtpUsername: "",
    smtpPassword: "",
    smtpPasswordSet: false,
    smtpFromEmail: "no-reply@qoqon.ru",
    smtpFromName: "Qoqon",
    smtpReplyTo: "",
    smtpForceFromEmail: true,
    smtpForceFromName: false,
    smtpUseFromAsReplyTo: true,
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
          smtpEncryption:
            data.smtpEncryption === "ssl" || data.smtpEncryption === "tls"
              ? data.smtpEncryption
              : "none",
          smtpAutoTls: data.smtpAutoTls !== false,
          smtpAuthEnabled: data.smtpAuthEnabled !== false,
          smtpUsername: data.smtpUsername || "",
          smtpPassword: "",
          smtpPasswordSet: data.smtpPasswordSet === true,
          smtpFromEmail: data.smtpFromEmail || prev.smtpFromEmail,
          smtpFromName: data.smtpFromName || prev.smtpFromName,
          smtpReplyTo: data.smtpReplyTo || "",
          smtpForceFromEmail: data.smtpForceFromEmail !== false,
          smtpForceFromName: data.smtpForceFromName === true,
          smtpUseFromAsReplyTo: data.smtpUseFromAsReplyTo === true,
        }));
      })
      .catch(() => toast.error("Не удалось загрузить email-настройки"))
      .finally(() => setLoading(false));
  }, []);

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
          Упрощенная настройка внешнего SMTP-сервера (например, Yandex 360)
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={values.enabled}
          onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm">Включить отправку email в системе</span>
      </label>

      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Быстрый пресет</p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setValues((v) => ({
              ...v,
              smtpHost: "smtp.yandex.ru",
              smtpPort: 465,
              smtpEncryption: "ssl",
              smtpAutoTls: true,
              smtpAuthEnabled: true,
            }))
          }
        >
          Применить Yandex SMTP
        </Button>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Настройки отправителя</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Эл. адрес отправителя</label>
            <Input
              value={values.smtpFromEmail}
              onChange={(e) => setValues((v) => ({ ...v, smtpFromEmail: e.target.value }))}
              placeholder="hi@domain.tld"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Имя отправителя</label>
            <Input
              value={values.smtpFromName}
              onChange={(e) => setValues((v) => ({ ...v, smtpFromName: e.target.value }))}
              placeholder="Qoqon"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.smtpForceFromEmail}
              onChange={(e) => setValues((v) => ({ ...v, smtpForceFromEmail: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Всегда использовать этот адрес отправителя</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.smtpForceFromName}
              onChange={(e) => setValues((v) => ({ ...v, smtpForceFromName: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Всегда использовать это имя отправителя</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.smtpUseFromAsReplyTo}
              onChange={(e) => setValues((v) => ({ ...v, smtpUseFromAsReplyTo: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Использовать этот адрес как Reply-To</span>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">SMTP подключение</h3>
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
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-foreground">Encryption</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {(["none", "ssl", "tls"] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="smtpEncryption"
                  checked={values.smtpEncryption === mode}
                  onChange={() => setValues((v) => ({ ...v, smtpEncryption: mode }))}
                  className="h-4 w-4 border-border accent-primary"
                />
                <span>{mode.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.smtpAutoTls}
            onChange={(e) => setValues((v) => ({ ...v, smtpAutoTls: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm">Use Auto TLS</span>
        </label>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.smtpAuthEnabled}
            onChange={(e) => setValues((v) => ({ ...v, smtpAuthEnabled: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm">Authentication</span>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP username</label>
            <Input
              value={values.smtpUsername}
              onChange={(e) => setValues((v) => ({ ...v, smtpUsername: e.target.value }))}
              placeholder="hi@domain.tld"
              disabled={!values.smtpAuthEnabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">SMTP password</label>
            <Input
              type="password"
              value={values.smtpPassword}
              onChange={(e) => setValues((v) => ({ ...v, smtpPassword: e.target.value }))}
              placeholder={values.smtpPasswordSet ? "•••••••• (сохранён)" : "Введите пароль"}
              disabled={!values.smtpAuthEnabled}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
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
