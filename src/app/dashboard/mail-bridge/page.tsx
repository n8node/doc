"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Key,
  Trash2,
  Copy,
  Mail,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type MailAccount = {
  id: string;
  email: string;
  label: string | null;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  syncDaysBack: number;
  createdAt: string;
};

type AutomationKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-zinc-300/80 bg-zinc-100/90 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-800 dark:border-zinc-600/80 dark:bg-zinc-800/70 dark:text-zinc-200">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200">
      {children}
    </pre>
  );
}

export default function MailBridgePage() {
  const [loading, setLoading] = useState(true);
  const [featureOn, setFeatureOn] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  const [accounts, setAccounts] = useState<MailAccount[]>([]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSyncDays, setNewSyncDays] = useState("90");
  const [savingNew, setSavingNew] = useState(false);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSyncDays, setEditSyncDays] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [automationKeys, setAutomationKeys] = useState<AutomationKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("n8n");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const planRes = await fetch("/api/v1/plans/me");
      const planData = await planRes.json();
      const feats = planData.features ?? {};
      const on = feats.mail_bridge === true;
      setFeatureOn(on);

      if (typeof window !== "undefined") {
        setBaseUrl(window.location.origin);
      }

      if (!on) {
        return;
      }

      const accRes = await fetch("/api/v1/mail-bridge/accounts");
      if (accRes.status === 403) {
        setAccounts([]);
        return;
      }
      const accData = await accRes.json();
      setAccounts(Array.isArray(accData.accounts) ? accData.accounts : []);

      const keysRes = await fetch("/api/v1/mail-bridge/automation-keys");
      if (keysRes.ok) {
        const k = await keysRes.json();
        setAutomationKeys(Array.isArray(k.keys) ? k.keys : []);
      } else {
        setAutomationKeys([]);
      }
    } catch {
      toast.error("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNew(true);
    try {
      const sd = Number.parseInt(newSyncDays, 10);
      const res = await fetch("/api/v1/mail-bridge/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          label: newLabel.trim() || undefined,
          syncDaysBack: Number.isFinite(sd) ? sd : 90,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
      toast.success("Ящик подключён");
      setNewEmail("");
      setNewPassword("");
      setNewLabel("");
      setNewSyncDays("90");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingNew(false);
    }
  };

  const runSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/v1/mail-bridge/accounts/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      toast.success(`Синхронизация: ${data.messagesUpserted ?? 0} писем`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот ящик и кэш писем?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/mail-bridge/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка");
      toast.success("Ящик отключён");
      if (editId === id) {
        setEditId(null);
        setEditPassword("");
      }
      await load();
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (a: MailAccount) => {
    setEditId(a.id);
    setEditLabel(a.label ?? "");
    setEditSyncDays(String(a.syncDaysBack));
    setEditPassword("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      const sd = Number.parseInt(editSyncDays, 10);
      const body: { label?: string | null; syncDaysBack?: number; password?: string } = {
        label: editLabel.trim() || null,
        syncDaysBack: Number.isFinite(sd) ? sd : 90,
      };
      if (editPassword.trim()) {
        body.password = editPassword;
      }
      const res = await fetch(`/api/v1/mail-bridge/accounts/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
      toast.success("Сохранено");
      setEditPassword("");
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingEdit(false);
    }
  };

  const createAutomationKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const res = await fetch("/api/v1/mail-bridge/automation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() || "n8n" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setNewKeyValue(data.key ?? null);
      setAutomationKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("Ключ создан — сохраните его, он показывается один раз.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteAutomationKey = async (id: string) => {
    setDeletingKeyId(id);
    try {
      const res = await fetch(`/api/v1/mail-bridge/automation-keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Ошибка удаления");
      setAutomationKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Ключ удалён");
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setDeletingKeyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!featureOn) {
    return (
      <div className="w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Почта (Яндекс)</h1>
          <p className="mt-2 text-muted-foreground">
            Мост между Яндекс.Почтой (IMAP/SMTP) и вашими сценариями автоматизации. Доступно на тарифах с функцией
            «Мост почты».
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 py-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              На вашем текущем тарифе эта возможность не включена. Выберите тариф с функцией mail_bridge в админке или
              оформите подходящий план.
            </p>
            <Link href="/dashboard/plans" className={buttonVariants({ variant: "default" })}>
              Тарифы
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messagesBase = `${baseUrl}/api/v1/integrations/mail/messages`;
  const authExample = `Authorization: Bearer mail_ВАШ_КЛЮЧ`;

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Mail className="h-7 w-7 shrink-0 text-muted-foreground" />
          Почта (Яндекс)
        </h1>
        <p className="mt-2 text-muted-foreground">
          Почта остаётся на серверах Яндекса. Вы передаёте в QoQon только пароль приложения: мы подключаемся по IMAP к
          папке «Входящие», кэшируем письма для API и можем отправлять письма через SMTP Яндекса — без настройки IMAP внутри
          n8n. Можно подключить несколько ящиков @yandex.ru / @ya.ru / домен на Яндексе.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Пароль приложения Яндекса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            Включите двухфакторную аутентификацию в аккаунте Яндекса (если ещё не включена), затем создайте{" "}
            <a
              href="https://id.yandex.ru/security/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 decoration-muted-foreground hover:decoration-foreground"
            >
              пароль приложения <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
            </a>{" "}
            для «Почта». Укажите ниже полный email ящика и этот пароль — не основной пароль от аккаунта. Один и тот же
            пароль приложения можно использовать для разных сервисов, но для каждого подключённого в QoQon ящика логин
            (email) должен быть своим.
          </p>
          <p className="leading-relaxed">
            Серверы Яндекса: IMAP <InlineCode>imap.yandex.ru:993</InlineCode> (SSL), SMTP{" "}
            <InlineCode>smtp.yandex.ru:465</InlineCode> (SSL). В кабинете QoQon хосты настраивать не нужно — они
            зашиты в мост.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Подключить ящик</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Можно добавить несколько ящиков: каждый хранится отдельно. Поле «Подпись» — только для отображения в списке
            (например «Рабочий», «Личный»). «Глубина синка» — сколько дней назад подтягивать письма из «Входящих» при
            синхронизации (по умолчанию 90).
          </p>
          <form onSubmit={handleAddAccount} className="space-y-3 max-w-lg">
            <div>
              <Label htmlFor="mb-email">Email ящика</Label>
              <Input
                id="mb-email"
                type="email"
                autoComplete="username"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@yandex.ru"
              />
            </div>
            <div>
              <Label htmlFor="mb-pass">Пароль приложения</Label>
              <Input
                id="mb-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="mb-label">Подпись (необязательно)</Label>
              <Input
                id="mb-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Рабочий"
              />
            </div>
            <div>
              <Label htmlFor="mb-days">Глубина синка, дней</Label>
              <Input
                id="mb-days"
                type="number"
                min={1}
                max={365}
                value={newSyncDays}
                onChange={(e) => setNewSyncDays(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={savingNew}>
              {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : "Добавить ящик"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Подключённые ящики</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-4">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{a.label || a.email}</p>
                      <p className="text-sm text-muted-foreground">{a.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Статус: {a.status}
                        {a.lastSyncedAt && ` · синк: ${new Date(a.lastSyncedAt).toLocaleString()}`}
                        {a.lastError && ` · ${a.lastError}`}
                      </p>
                      <p className="text-xs mt-2">
                        <span className="text-muted-foreground">accountId для API:</span>{" "}
                        <InlineCode>{a.id}</InlineCode>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void runSync(a.id)}
                        disabled={syncingId === a.id}
                      >
                        {syncingId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Синхронизировать
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(a)}>
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deletingId === a.id}
                        onClick={() => void handleDelete(a.id)}
                      >
                        {deletingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                      </Button>
                    </div>
                  </div>

                  {editId === a.id && (
                    <form
                      onSubmit={saveEdit}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 space-y-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div>
                        <Label>Подпись</Label>
                        <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                      </div>
                      <div>
                        <Label>Глубина синка, дней</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={editSyncDays}
                          onChange={(e) => setEditSyncDays(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Новый пароль приложения (если сменили в Яндексе)</Label>
                        <Input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Оставьте пустым, если не меняли"
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={savingEdit}>
                          {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditId(null)}>
                          Отмена
                        </Button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Ключи для автоматизации (mail_…)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Отдельно от ключей <InlineCode>qk_…</InlineCode> (файлы) и <InlineCode>cal_…</InlineCode> (календарь).
              Заголовок:
            </p>
            <div className="inline-block max-w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs leading-snug text-zinc-800 break-all shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200">
              Authorization: Bearer mail_…
            </div>
          </div>
          <form onSubmit={createAutomationKey} className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Название</Label>
              <Input className="w-48" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
            </div>
            <Button type="submit" disabled={creatingKey}>
              {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать ключ"}
            </Button>
          </form>
          {newKeyValue && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200">
              <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Скопируйте ключ сейчас:</p>
              <code className="break-all font-mono text-xs">{newKeyValue}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(newKeyValue);
                  toast.success("Скопировано");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Копировать
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {automationKeys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {k.name} —{" "}
                  <code className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
                    {k.keyPrefix}
                  </code>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={deletingKeyId === k.id}
                  onClick={() => void deleteAutomationKey(k.id)}
                >
                  {deletingKeyId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Публичное API почты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            Базовый URL для списка: <InlineCode>{messagesBase}</InlineCode>. Во всех запросах заголовок{" "}
            <InlineCode>{authExample}</InlineCode> (или сессия в кабинете). Параметр{" "}
            <InlineCode>accountId</InlineCode> — id ящика из блока выше.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Список писем (кэш после синка)</p>
            <p>
              <InlineCode>GET</InlineCode> — обязательный query <InlineCode>accountId</InlineCode>; опционально{" "}
              <InlineCode>folder</InlineCode> (по умолчанию INBOX), <InlineCode>from</InlineCode>, <InlineCode>to</InlineCode>{" "}
              (ISO 8601), <InlineCode>limit</InlineCode> (1…200, по умолчанию 50).
            </p>
            <CodeBlock>{`${messagesBase}?accountId=ACCOUNT_ID&limit=50`}</CodeBlock>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Одно письмо</p>
            <p>
              <InlineCode>{`GET ${baseUrl}/api/v1/integrations/mail/messages/:id`}</InlineCode> —{" "}
              <InlineCode>id</InlineCode> из поля <InlineCode>messages[].id</InlineCode>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Отправить письмо (SMTP Яндекса)</p>
            <p>
              <InlineCode>POST {baseUrl}/api/v1/integrations/mail/send</InlineCode> — JSON:{" "}
              <InlineCode>accountId</InlineCode>, <InlineCode>to</InlineCode>, <InlineCode>subject</InlineCode>, и хотя бы
              одно из <InlineCode>text</InlineCode> / <InlineCode>html</InlineCode>.
            </p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="font-medium text-foreground">Фоновая синхронизация (сервер)</p>
            <p>
              <InlineCode>POST /api/v1/cron/mail-bridge-sync</InlineCode> с{" "}
              <InlineCode>Authorization: Bearer CRON_SECRET</InlineCode>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">n8n: узел HTTP Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Создайте ключ <InlineCode>mail_…</InlineCode> выше. В ноде: заголовок{" "}
              <InlineCode>Authorization</InlineCode> = <InlineCode>Bearer …</InlineCode>.
            </li>
            <li>
              <span className="font-medium text-foreground">Чтение:</span> GET на URL списка, подставьте{" "}
              <InlineCode>accountId</InlineCode> своего ящика.
            </li>
            <li>
              <span className="font-medium text-foreground">Отправка:</span> POST на{" "}
              <InlineCode>/api/v1/integrations/mail/send</InlineCode> с JSON телом.
            </li>
            <li>
              Сначала нажмите «Синхронизировать» в кабинете или настройте cron на сервере, иначе список писем будет пустым.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
