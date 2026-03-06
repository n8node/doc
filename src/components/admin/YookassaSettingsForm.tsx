"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Wifi, Eye, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";

const DEFAULT_RETURN_URL = "https://qoqon.ru/dashboard/plans";

export function YookassaSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    accountId?: string;
    status?: string;
  } | null>(null);
  const [values, setValues] = useState({
    shopId: "",
    secretKey: "",
    returnUrl: DEFAULT_RETURN_URL,
    enabled: true,
  });

  useEffect(() => {
    fetch("/api/v1/admin/yookassa")
      .then((r) => r.json())
      .then((data) => {
        if (data.shopId) setValues((v) => ({ ...v, shopId: data.shopId }));
        if (data.returnUrl) setValues((v) => ({ ...v, returnUrl: data.returnUrl }));
        if (typeof data.enabled === "boolean") setValues((v) => ({ ...v, enabled: data.enabled }));
        if (data.secretKeySet) setValues((v) => ({ ...v, secretKey: "••••••••" }));
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        shopId: values.shopId,
        returnUrl: values.returnUrl,
        enabled: values.enabled,
      };
      if (values.secretKey && values.secretKey !== "••••••••") {
        body.secretKey = values.secretKey;
      }
      const res = await fetch("/api/v1/admin/yookassa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        shopId: values.shopId,
      };
      if (values.secretKey && values.secretKey !== "••••••••") {
        body.secretKey = values.secretKey;
      }
      const res = await fetch("/api/v1/admin/yookassa/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok ?? false,
        message: data.message ?? (data.ok ? "Подключение успешно!" : "Ошибка"),
        accountId: data.accountId,
        status: data.status,
      });
      if (data.ok) {
        toast.success(data.message ?? "Подключение успешно!");
      } else {
        toast.error(data.message ?? "Ошибка подключения");
      }
    } catch {
      setTestResult({ ok: false, message: "Ошибка запроса" });
      toast.error("Ошибка запроса");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Подключение ЮKassa для приёма платежей</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Настройки для пополнения кошелька и подписки на тарифы
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Shop ID (идентификатор магазина)
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Находится в личном кабинете ЮKassa → Настройки → Параметры магазина
          </p>
          <Input
            type="text"
            value={values.shopId}
            onChange={(e) => setValues((v) => ({ ...v, shopId: e.target.value }))}
            placeholder="1169828"
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Секретный ключ API
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Генерируется в ЮKassa → Настройки → API ключи. Хранится в зашифрованном виде.
          </p>
          <div className="relative mt-1 max-w-md">
            <Input
              type={showSecretKey ? "text" : "password"}
              value={values.secretKey}
              onChange={(e) => setValues((v) => ({ ...v, secretKey: e.target.value }))}
              placeholder="••••••••"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowSecretKey((s) => !s)}
              aria-label={showSecretKey ? "Скрыть" : "Показать"}
            >
              {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            URL возврата после оплаты
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Куда перенаправить пользователя после оплаты. Обычно страница тарифов или кошелька.
          </p>
          <Input
            type="url"
            value={values.returnUrl}
            onChange={(e) => setValues((v) => ({ ...v, returnUrl: e.target.value }))}
            placeholder={DEFAULT_RETURN_URL}
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Приём платежей
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Включить пополнение кошелька и подписку через ЮKassa</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface2 p-4">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          <Wifi className="h-4 w-4" />
          Проверка подключения
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Отправляет запрос к API ЮKassa для проверки корректности Shop ID и секретного ключа.
        </p>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || !values.shopId || !values.secretKey}
          className="mt-4"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Проверка...
            </>
          ) : (
            <>
              <Wifi className="mr-2 h-4 w-4" />
              Проверить подключение
            </>
          )}
        </Button>
        {testResult && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              testResult.ok
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-red-500/50 bg-red-500/10"
            }`}
          >
            {testResult.ok ? (
              <>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{testResult.message}</span>
                </div>
                {testResult.accountId != null && (
                  <p className="mt-2 text-sm text-emerald-700/90 dark:text-emerald-400/90">
                    ID аккаунта: {testResult.accountId}
                  </p>
                )}
                {testResult.status != null && (
                  <p className="text-sm text-emerald-700/90 dark:text-emerald-400/90">
                    Статус: {testResult.status}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-400">{testResult.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface2 p-4">
        <h3 className="font-medium text-foreground">Инструкция по подключению</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Зарегистрируйтесь в{" "}
            <Link href="https://yookassa.ru" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              ЮKassa
            </Link>{" "}
            и создайте магазин.
          </li>
          <li>В настройках магазина скопируйте Shop ID.</li>
          <li>Перейдите в Интеграция → Ключи API и создайте секретный ключ.</li>
          <li>Вставьте данные в форму выше и сохраните.</li>
        </ol>
      </div>
    </div>
  );
}
