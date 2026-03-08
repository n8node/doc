"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Eye, EyeOff, CheckCircle, Play, Square } from "lucide-react";

export function TelegramSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [botRunning, setBotRunning] = useState<boolean | null>(null);
  const [autoStartEnabled, setAutoStartEnabled] = useState<boolean>(false);
  const [autoStartSource, setAutoStartSource] = useState<"env" | "config" | null>(null);
  const [botAction, setBotAction] = useState(false);
  const [values, setValues] = useState({
    botToken: "",
    chatId: "",
    notifyRegisterEnabled: true,
    notifyPaymentEnabled: true,
    registerMessage: "",
    paymentMessage: "",
  });

  const fetchBotStatus = () => {
    fetch("/api/v1/admin/telegram-bot")
      .then((r) => r.json())
      .then((data) => {
        setBotRunning(data.running === true);
        setAutoStartEnabled(data.autoStartEnabled === true);
        setAutoStartSource(data.autoStartSource ?? null);
      })
      .catch(() => setBotRunning(null));
  };

  useEffect(() => {
    fetchBotStatus();
  }, []);

  useEffect(() => {
    fetch("/api/v1/admin/telegram")
      .then((r) => r.json())
      .then((data) => {
        setValues((v) => ({
          ...v,
          chatId: data.chatId ?? "",
          botToken: data.botTokenSet ? "••••••••" : "",
          notifyRegisterEnabled: data.notifyRegisterEnabled !== false,
          notifyPaymentEnabled: data.notifyPaymentEnabled !== false,
          registerMessage: data.registerMessage ?? data.defaultRegisterMessage ?? "",
          paymentMessage: data.paymentMessage ?? data.defaultPaymentMessage ?? "",
        }));
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleBotStart = async () => {
    setBotAction(true);
    try {
      const res = await fetch("/api/v1/admin/telegram-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message);
        setBotRunning(true);
        setAutoStartEnabled(true);
        setAutoStartSource("config");
      } else toast.error(data.message ?? "Ошибка");
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setBotAction(false);
    }
  };

  const handleBotStop = async () => {
    setBotAction(true);
    try {
      const res = await fetch("/api/v1/admin/telegram-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message);
        setBotRunning(false);
        fetchBotStatus(); // обновить autoStartEnabled (env может оставаться активным)
      } else toast.error(data.message ?? "Ошибка");
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setBotAction(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        chatId: values.chatId.trim(),
        notifyRegisterEnabled: values.notifyRegisterEnabled,
        notifyPaymentEnabled: values.notifyPaymentEnabled,
        registerMessage: values.registerMessage || undefined,
        paymentMessage: values.paymentMessage || undefined,
      };
      if (values.botToken && values.botToken !== "••••••••") {
        body.botToken = values.botToken;
      }
      const res = await fetch("/api/v1/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      if (values.botToken && values.botToken !== "••••••••") {
        setValues((v) => ({ ...v, botToken: "••••••••" }));
      }
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
      const res = await fetch("/api/v1/admin/telegram/test", { method: "POST" });
      const data = await res.json();
      setTestResult({
        ok: data.ok ?? false,
        message: data.message ?? (data.ok ? "Сообщение отправлено" : "Ошибка"),
      });
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
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
        <h2 className="text-lg font-semibold text-foreground">Telegram уведомления</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Уведомления о регистрации и оплате тарифов приходят в указанный чат
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">Токен бота</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Получите у @BotFather в Telegram. Хранится в зашифрованном виде.
          </p>
          <div className="relative mt-1 max-w-md">
            <Input
              type={showToken ? "text" : "password"}
              value={values.botToken}
              onChange={(e) => setValues((v) => ({ ...v, botToken: e.target.value }))}
              placeholder="123456:ABC..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowToken((s) => !s)}
              aria-label={showToken ? "Скрыть" : "Показать"}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">ID чата</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Числовой ID (личный чат или группы). Узнать: @userinfobot или getUpdates
          </p>
          <Input
            type="text"
            value={values.chatId}
            onChange={(e) => setValues((v) => ({ ...v, chatId: e.target.value }))}
            placeholder="-1001234567890"
            className="mt-1 max-w-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Уведомлять о регистрации</label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.notifyRegisterEnabled}
              onChange={(e) => setValues((v) => ({ ...v, notifyRegisterEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Отправлять сообщение при каждой регистрации</span>
          </label>
          <div className="mt-2">
            <label className="block text-xs text-muted-foreground mb-1">Шаблон: {`{email} {name}`}</label>
            <textarea
              value={values.registerMessage}
              onChange={(e) => setValues((v) => ({ ...v, registerMessage: e.target.value }))}
              placeholder="🆕 Новый пользователь\nEmail: {email}\nИмя: {name}"
              rows={4}
              className="mt-1 w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Уведомлять об оплате</label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.notifyPaymentEnabled}
              onChange={(e) => setValues((v) => ({ ...v, notifyPaymentEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Отправлять сообщение при успешной оплате тарифа</span>
          </label>
          <div className="mt-2">
            <label className="block text-xs text-muted-foreground mb-1">
              Шаблон: {`{userEmail} {userName} {planName} {amount} {currency}`}
            </label>
            <textarea
              value={values.paymentMessage}
              onChange={(e) => setValues((v) => ({ ...v, paymentMessage: e.target.value }))}
              placeholder="💰 Оплата тарифа\nПользователь: {userEmail}\nТариф: {planName}\nСумма: {amount} {currency}"
              rows={4}
              className="mt-1 w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
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
          <Play className="h-4 w-4" />
          Бот для входа через QR
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Бот обрабатывает /start login_xxx при входе по QR. Запускается внутри приложения.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Статус: {botRunning === null ? "—" : botRunning ? "запущен" : "остановлен"}
          </span>
          {autoStartEnabled && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
              title={
                autoStartSource === "env"
                  ? "Автозапуск включён через TELEGRAM_BOT_AUTO_START"
                  : "Бот будет запускаться при перезагрузке"
              }
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Автозапуск при перезагрузке{autoStartSource === "env" ? " (env)" : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleBotStart}
            disabled={botAction || botRunning === true}
          >
            {botAction ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            Запустить
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBotStop}
            disabled={botAction || botRunning === false}
          >
            <Square className="mr-1 h-4 w-4" />
            Остановить
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface2 p-4">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          <Send className="h-4 w-4" />
          Проверка
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Отправит тестовое сообщение в указанный чат
        </p>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || !values.chatId || !values.botToken}
          className="mt-4"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Отправка...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Отправить тестовое сообщение
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
            <div
              className={`flex items-center gap-2 ${
                testResult.ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {testResult.ok && <CheckCircle className="h-5 w-5" />}
              <span className="font-medium">{testResult.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
