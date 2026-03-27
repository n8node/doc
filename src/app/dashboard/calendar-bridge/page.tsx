"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Key,
  Trash2,
  Copy,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
type RemoteCal = { url: string; displayName: string | null; ctag: string | null };

type Sub = {
  id: string;
  resourceHref: string;
  displayName: string | null;
  enabled: boolean;
};

type AutomationKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function CalendarBridgePage() {
  const [loading, setLoading] = useState(true);
  const [featureOn, setFeatureOn] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);

  const [remoteCalendars, setRemoteCalendars] = useState<RemoteCal[]>([]);
  const [selectedHrefs, setSelectedHrefs] = useState<Set<string>>(new Set());
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingSubs, setSavingSubs] = useState(false);

  const [syncing, setSyncing] = useState(false);

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
      const on = feats.calendar_bridge === true;
      setFeatureOn(on);

      if (typeof window !== "undefined") {
        setBaseUrl(window.location.origin);
      }

      if (!on) {
        return;
      }

      const accRes = await fetch("/api/v1/calendar-bridge/account");
      if (accRes.status === 403) {
        setAccountId(null);
        setSubs([]);
        return;
      }
      const accData = await accRes.json();
      const a = accData.account;
      if (a) {
        setAccountId(a.id);
        setAccountStatus(a.status);
        setLastSyncedAt(a.lastSyncedAt);
        setLastError(a.lastError);
        setSubs(a.subscriptions ?? []);
        const hrefs = new Set<string>(
          (a.subscriptions as Sub[]).map((s: Sub) => s.resourceHref)
        );
        setSelectedHrefs(hrefs);
      } else {
        setAccountId(null);
        setSubs([]);
      }

      const keysRes = await fetch("/api/v1/calendar-bridge/automation-keys");
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

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    try {
      const res = await fetch("/api/v1/calendar-bridge/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
      toast.success("Подключение сохранено");
      setPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingCreds(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Удалить подключение к Яндексу и кэш событий?")) return;
    const res = await fetch("/api/v1/calendar-bridge/account", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Не удалось отключить");
      return;
    }
    toast.success("Отключено");
    setAccountId(null);
    setRemoteCalendars([]);
    setSelectedHrefs(new Set());
    await load();
  };

  const loadRemoteCalendars = async () => {
    setLoadingCalendars(true);
    try {
      const res = await fetch("/api/v1/calendar-bridge/calendars");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      const list: RemoteCal[] = data.calendars ?? [];
      setRemoteCalendars(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки списка");
    } finally {
      setLoadingCalendars(false);
    }
  };

  const toggleHref = (url: string) => {
    setSelectedHrefs((prev) => {
      const n = new Set(prev);
      if (n.has(url)) n.delete(url);
      else n.add(url);
      return n;
    });
  };

  const saveSubscriptions = async () => {
    if (selectedHrefs.size === 0) {
      toast.error("Выберите календари");
      return;
    }
    setSavingSubs(true);
    try {
      const res = await fetch("/api/v1/calendar-bridge/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceHrefs: Array.from(selectedHrefs) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      toast.success("Календари сохранены");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingSubs(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/calendar-bridge/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      toast.success(`Синхронизация: ${data.eventsUpserted ?? 0} событий`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSyncing(false);
    }
  };

  const createAutomationKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const res = await fetch("/api/v1/calendar-bridge/automation-keys", {
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
      const res = await fetch(`/api/v1/calendar-bridge/automation-keys/${id}`, {
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Календарь для n8n</h1>
          <p className="mt-2 text-muted-foreground">
            Мост между Яндекс.Календарём (CalDAV) и вашими сценариями автоматизации. Доступно на тарифах с
            функцией «Мост календаря».
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 py-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              На вашем текущем тарифе эта возможность не включена. Выберите тариф с функцией calendar_bridge в
              админке или оформите подходящий план.
            </p>
            <Link href="/dashboard/plans" className={buttonVariants({ variant: "default" })}>
              Тарифы
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventsUrl = `${baseUrl}/api/v1/integrations/calendar/events`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Calendar className="h-7 w-7 text-primary" />
          Календарь для n8n
        </h1>
        <p className="mt-2 text-muted-foreground">
          Основной календарь остаётся в Яндексе. Здесь вы передаёте учётные данные только в QoQon: мы синхронизируем
          выбранные календари и отдаём события через API для n8n и других систем — без настройки CalDAV внутри n8n.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Яндекс.Календарь (CalDAV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Создайте{" "}
            <a
              href="https://id.yandex.ru/security/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              пароль приложения <ExternalLink className="h-3 w-3" />
            </a>{" "}
            для почты Яндекса и укажите логин (полный email) и этот пароль ниже — не основной пароль от аккаунта.
          </p>
          <form onSubmit={handleSaveCredentials} className="space-y-3 max-w-md">
            <div>
              <Label htmlFor="cal-login">Логин Яндекса (email)</Label>
              <Input
                id="cal-login"
                type="email"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="you@yandex.ru"
              />
            </div>
            <div>
              <Label htmlFor="cal-pass">Пароль приложения</Label>
              <Input
                id="cal-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingCreds}>
                {savingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить и проверить"}
              </Button>
              {accountId && (
                <Button type="button" variant="outline" onClick={handleDisconnect}>
                  Отключить
                </Button>
              )}
            </div>
          </form>
          {accountId && (
            <p className="text-xs text-muted-foreground">
              Статус: {accountStatus}
              {lastSyncedAt && ` · последний синк: ${new Date(lastSyncedAt).toLocaleString()}`}
              {lastError && ` · ошибка: ${lastError}`}
            </p>
          )}
        </CardContent>
      </Card>

      {accountId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Какие календари синхронизировать</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadRemoteCalendars()}
              disabled={loadingCalendars}
            >
              {loadingCalendars ? <Loader2 className="h-4 w-4 animate-spin" /> : "Загрузить список календарей"}
            </Button>
            {remoteCalendars.length > 0 && (
              <ul className="space-y-2">
                {remoteCalendars.map((c) => (
                  <li key={c.url}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedHrefs.has(c.url)}
                        onChange={() => toggleHref(c.url)}
                        className="rounded border-border"
                      />
                      <span>{c.displayName || c.url}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => void saveSubscriptions()} disabled={savingSubs || selectedHrefs.size === 0}>
              {savingSubs ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить выбор"}
            </Button>
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => void runSync()} disabled={syncing || subs.length === 0}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Синхронизировать сейчас
              </Button>
              <span className="text-xs text-muted-foreground">
                Подключённые календари: {subs.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Ключи для автоматизации (cal_…)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Отдельно от обычного API-ключа файлов. Используйте заголовок{" "}
            <code className="rounded bg-muted px-1">Authorization: Bearer cal_…</code> для запросов к календарю.
          </p>
          <form onSubmit={createAutomationKey} className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Название</Label>
              <Input
                className="w-48"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={creatingKey}>
              {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать ключ"}
            </Button>
          </form>
          {newKeyValue && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="mb-2 font-medium">Скопируйте ключ сейчас:</p>
              <code className="break-all text-xs">{newKeyValue}</code>
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
                  {k.name} — <code className="text-xs">{k.keyPrefix}</code>
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
          <CardTitle className="text-lg">Что сделать в n8n</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none text-sm text-muted-foreground dark:prose-invert">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Создайте ключ выше и скопируйте значение <code>cal_…</code> (он показывается один раз).</li>
            <li>
              Добавьте узел <strong>HTTP Request</strong>: метод GET, URL:
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
                {eventsUrl}?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z
              </pre>
            </li>
            <li>
              В разделе Authentication выберите Generic Credential или Header Auth: имя заголовка{" "}
              <code>Authorization</code>, значение <code>Bearer ВАШ_КЛЮЧ_cal_…</code>.
            </li>
            <li>
              Ответ JSON: массив <code>events</code> с полями <code>summary</code>, <code>startAt</code>,{" "}
              <code>endAt</code>, <code>calendar.displayName</code> и др. Пароль Яндекса в n8n не вводится.
            </li>
            <li>
              По расписанию: триггер Schedule → HTTP Request к тому же URL с актуальным диапазоном дат, либо настройте
              cron на сервере QoQon (<code>POST /api/v1/cron/calendar-bridge-sync</code> с{" "}
              <code>Authorization: Bearer CRON_SECRET</code>) для фоновой синхронизации.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
