"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/80 p-3 font-mono text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

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
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Календари (CalDav)</h1>
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

  const eventsBase = `${baseUrl}/api/v1/integrations/calendar/events`;
  const authExample = `Authorization: Bearer cal_ВАШ_КЛЮЧ`;

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Calendar className="h-7 w-7 shrink-0 text-muted-foreground" />
          Календари (CalDav)
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
              className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 decoration-muted-foreground hover:decoration-foreground"
            >
              пароль приложения <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
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
            {subs.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground">
                <p className="mb-2 font-medium">subscriptionId для API (POST создание события):</p>
                <ul className="space-y-1.5">
                  {subs.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline gap-2">
                      <InlineCode>{s.id}</InlineCode>
                      <span className="text-muted-foreground">{s.displayName ?? s.resourceHref}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Отдельно от обычного API-ключа файлов. Для запросов к календарю задайте HTTP-заголовок (не вводите пароль
              Яндекса в n8n):
            </p>
            <div className="inline-block max-w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-xs leading-snug text-foreground break-all">
              Authorization: Bearer cal_…
            </div>
          </div>
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
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
              <p className="mb-2 font-medium text-foreground">Скопируйте ключ сейчас:</p>
              <code className="break-all text-xs text-foreground">{newKeyValue}</code>
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
          <CardTitle className="text-lg">Публичное API календаря</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <p>
            Базовый URL: <InlineCode>{eventsBase}</InlineCode>. Во всех запросах заголовок{" "}
            <InlineCode>{authExample}</InlineCode> (или сессия браузера в кабинете). Пароль Яндекса в теле запросов
            не передаётся.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Список событий (кэш после синка)</p>
            <p>
              <InlineCode>GET</InlineCode> — query: <InlineCode>from</InlineCode>, <InlineCode>to</InlineCode> (ISO
              8601), опционально <InlineCode>subscriptionIds</InlineCode> (через запятую).
            </p>
            <CodeBlock>{`${eventsBase}?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z`}</CodeBlock>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Одно событие</p>
            <p>
              <InlineCode>{`GET ${eventsBase}/:id`}</InlineCode> — параметр <InlineCode>id</InlineCode> из поля{" "}
              <InlineCode>events[].id</InlineCode>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Создать событие в Яндексе</p>
            <p>
              <InlineCode>POST</InlineCode> — JSON: <InlineCode>subscriptionId</InlineCode> (id подписки в вашем
              аккаунте), <InlineCode>summary</InlineCode>, <InlineCode>startAt</InlineCode>, <InlineCode>endAt</InlineCode>
              , опционально <InlineCode>allDay</InlineCode>, <InlineCode>location</InlineCode>,{" "}
              <InlineCode>description</InlineCode>.
            </p>
            <CodeBlock>{`curl -sS -X POST "${eventsBase}" \\
  -H "Content-Type: application/json" \\
  -H "${authExample}" \\
  -d '{"subscriptionId":"SUB_ID","summary":"Встреча","startAt":"2025-06-01T10:00:00.000Z","endAt":"2025-06-01T11:00:00.000Z"}'`}</CodeBlock>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Изменить событие</p>
            <p>
              <InlineCode>{`PATCH ${eventsBase}/:id`}</InlineCode> — в теле только нужные поля:{" "}
              <InlineCode>summary</InlineCode>, <InlineCode>startAt</InlineCode>, <InlineCode>endAt</InlineCode>,{" "}
              <InlineCode>allDay</InlineCode>, <InlineCode>location</InlineCode>, <InlineCode>description</InlineCode>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Удалить событие</p>
            <p>
              <InlineCode>{`DELETE ${eventsBase}/:id`}</InlineCode>
            </p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="font-medium text-foreground">Фоновая синхронизация кэша (сервер)</p>
            <p>
              <InlineCode>POST /api/v1/cron/calendar-bridge-sync</InlineCode> с{" "}
              <InlineCode>Authorization: Bearer CRON_SECRET</InlineCode> — обновляет все подключённые аккаунты.
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
              Создайте ключ <InlineCode>cal_…</InlineCode> выше (показывается один раз). В ноде укажите аутентификацию по
              заголовку: имя <InlineCode>Authorization</InlineCode>, значение <InlineCode>Bearer …</InlineCode>.
            </li>
            <li>
              <span className="text-foreground font-medium">Чтение списка:</span> метод GET, URL как в блоке выше, подставьте
              свой диапазон дат (можно выражениями n8n для «сегодня—через месяц»).
            </li>
            <li>
              <span className="text-foreground font-medium">Создание:</span> метод POST, тот же базовый URL, Body → JSON,
              поля как в примере curl. <InlineCode>subscriptionId</InlineCode> один раз скопируйте из ответа API кабинета
              или из <InlineCode>GET</InlineCode> после сохранения подписок.
            </li>
            <li>
              <span className="text-foreground font-medium">Изменение / удаление:</span> PATCH или DELETE на{" "}
              <InlineCode>…/events/&#123;&#123; $json.id &#125;&#125;</InlineCode> после узла, где есть id события.
            </li>
            <li>
              Расписание: триггер Schedule → цепочка HTTP Request; либо только cron на сервере для синка кэша, а чтение
              по расписанию из n8n.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
