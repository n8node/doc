"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield } from "lucide-react";

export function AuthSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    emailRegistrationEnabled: true,
    telegramWidgetEnabled: false,
    telegramQrEnabled: false,
    telegramDomain: "qoqon.ru",
    telegramBotUsername: "",
  });

  useEffect(() => {
    fetch("/api/v1/admin/auth-settings")
      .then((r) => r.json())
      .then((data) => {
        setValues((v) => ({
          ...v,
          emailRegistrationEnabled: data.emailRegistrationEnabled !== false,
          telegramWidgetEnabled: data.telegramWidgetEnabled === true,
          telegramQrEnabled: data.telegramQrEnabled === true,
          telegramDomain: data.telegramDomain || "qoqon.ru",
          telegramBotUsername: data.telegramBotUsername || "",
        }));
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        ...values,
        telegramBotUsername: values.telegramBotUsername || undefined,
      }),
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
        <h2 className="text-lg font-semibold text-foreground">Авторизация и регистрация</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Управление способами входа на сайт
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Регистрация по email
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.emailRegistrationEnabled}
              onChange={(e) => setValues((v) => ({ ...v, emailRegistrationEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Включить классическую регистрацию (email + пароль)</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Вход через Telegram (кнопка)
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.telegramWidgetEnabled}
              onChange={(e) => setValues((v) => ({ ...v, telegramWidgetEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Показать кнопку «Войти через Telegram»</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Требуется токен бота в настройках Telegram. В BotFather задайте Domain для виджета.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Вход через Telegram (QR)
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.telegramQrEnabled}
              onChange={(e) => setValues((v) => ({ ...v, telegramQrEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Показать QR-код для входа через бота</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Требуется запущенный бот (long polling). Используется тот же токен, что в Telegram.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Домен для Telegram виджета
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Должен совпадать с доменом в BotFather → Domain
          </p>
          <Input
            type="text"
            value={values.telegramDomain}
            onChange={(e) => setValues((v) => ({ ...v, telegramDomain: e.target.value }))}
            placeholder="qoqon.ru"
            className="max-w-xs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Имя бота для виджета
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Username бота без @ (например: MyBot). Нужно для кнопки «Войти через Telegram»
          </p>
          <Input
            type="text"
            value={values.telegramBotUsername}
            onChange={(e) => setValues((v) => ({ ...v, telegramBotUsername: e.target.value }))}
            placeholder="MyBot"
            className="max-w-xs"
          />
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
            <>
              <Shield className="mr-2 h-4 w-4" />
              Сохранить
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
