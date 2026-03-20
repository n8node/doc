"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Shield } from "lucide-react";

export function AuthSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueCount, setIssueCount] = useState(10);
  const [values, setValues] = useState({
    emailRegistrationEnabled: true,
    emailVerificationRequired: true,
    inviteRegistrationEnabled: false,
    telegramWidgetEnabled: false,
    telegramQrEnabled: false,
    telegramDomain: "qoqon.ru",
    telegramBotUsername: "",
    vkOAuthEnabled: true,
    vkClientId: "",
    vkClientSecret: "",
    vkSecretSet: false,
    vkOAuthRedirectUri: "",
  });

  useEffect(() => {
    fetch("/api/v1/admin/auth-settings")
      .then((r) => r.json())
      .then((data) => {
        setValues((v) => ({
          ...v,
          emailRegistrationEnabled: data.emailRegistrationEnabled !== false,
          emailVerificationRequired: data.emailVerificationRequired !== false,
          inviteRegistrationEnabled: data.inviteRegistrationEnabled === true,
          telegramWidgetEnabled: data.telegramWidgetEnabled === true,
          telegramQrEnabled: data.telegramQrEnabled === true,
          telegramDomain: data.telegramDomain || "qoqon.ru",
          telegramBotUsername: data.telegramBotUsername || "",
          vkOAuthEnabled: data.vkOAuthEnabled !== false,
          vkClientId: data.vkClientId || "",
          vkClientSecret: "",
          vkSecretSet: data.vkSecretSet === true,
          vkOAuthRedirectUri: typeof data.vkOAuthRedirectUri === "string" ? data.vkOAuthRedirectUri : "",
        }));
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vkClientSecret = values.vkClientSecret;
      const payload: Record<string, unknown> = { ...values };
      delete payload.vkClientSecret;
      delete payload.vkSecretSet;
      delete payload.vkOAuthRedirectUri;
      const res = await fetch("/api/v1/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          telegramBotUsername: values.telegramBotUsername || undefined,
          vkClientId: values.vkClientId.trim(),
          ...(vkClientSecret.trim() ? { vkClientSecret: vkClientSecret.trim() } : {}),
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

  const handleIssueInvites = async () => {
    if (!Number.isInteger(issueCount) || issueCount < 1) {
      toast.error("Укажите корректное количество");
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch("/api/v1/admin/invites/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: issueCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка выпуска");
      toast.success(`Выпущено инвайтов: ${data.createdCount}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка выпуска");
    } finally {
      setIssuing(false);
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
            Подтверждение email при регистрации
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.emailVerificationRequired}
              onChange={(e) => setValues((v) => ({ ...v, emailVerificationRequired: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Отправлять письмо подтверждения и разрешать вход только после верификации</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Регистрация по инвайтам
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.inviteRegistrationEnabled}
              onChange={(e) => setValues((v) => ({ ...v, inviteRegistrationEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Требовать инвайт-ключ перед регистрацией</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            При включении пользователь сначала вводит ключ, затем видит форму регистрации.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Выпуск системных инвайтов
          </label>
          <div className="flex max-w-sm items-center gap-2">
            <Input
              type="number"
              min={1}
              max={200}
              value={issueCount}
              onChange={(e) => setIssueCount(Number(e.target.value || 0))}
            />
            <Button type="button" variant="outline" onClick={handleIssueInvites} disabled={issuing}>
              {issuing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Выпуск...
                </>
              ) : (
                "Выпустить"
              )}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Новые ключи автоматически попадут в конец публичного списка инвайтов.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface2/50 p-4 space-y-4">
          <label className="block text-sm font-medium text-foreground">
            ВКонтакте (OAuth)
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={values.vkOAuthEnabled}
              onChange={(e) => setValues((v) => ({ ...v, vkOAuthEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Разрешить вход и регистрацию через VK</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ID приложения (client_id)</label>
            <Input
              type="text"
              value={values.vkClientId}
              onChange={(e) => setValues((v) => ({ ...v, vkClientId: e.target.value }))}
              placeholder="Например 12345678"
              className="max-w-md font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Защищённый ключ (client_secret)
              {values.vkSecretSet && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">· сохранён</span>
              )}
            </label>
            <Input
              type="password"
              value={values.vkClientSecret}
              onChange={(e) => setValues((v) => ({ ...v, vkClientSecret: e.target.value }))}
              placeholder={values.vkSecretSet ? "Введите новый ключ, чтобы заменить" : "Секретный ключ из кабинета VK"}
              className="max-w-md font-mono text-sm"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Хранится в БД в зашифрованном виде. Можно дублировать в переменных окружения VK_CLIENT_ID / VK_CLIENT_SECRET.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Redirect URI для VK (скопируйте в кабинет разработчика)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-muted px-2 py-1 text-[11px] leading-relaxed">
                {values.vkOAuthRedirectUri || "…"}
              </code>
              {values.vkOAuthRedirectUri ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8"
                  onClick={() => {
                    void navigator.clipboard.writeText(values.vkOAuthRedirectUri).then(
                      () => toast.success("Скопировано"),
                      () => toast.error("Не удалось скопировать")
                    );
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Копировать
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              В{" "}
              <a
                href="https://dev.vk.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                dev.vk.com
              </a>{" "}
              откройте приложение → настройки OAuth: добавьте этот адрес в список доверенных redirect URI{" "}
              <span className="text-foreground">без изменений</span> (протокол https, путь{" "}
              <code className="text-[11px]">/api/auth/callback/vk</code>).
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
              Если VK показывает страницу с ошибкой до входа: чаще всего тип приложения «Standalone» — для сайта
              нужно приложение типа «Веб-сайт» (или отдельное приложение под сайт). У Standalone разрешён только
              redirect <code className="text-[11px]">https://oauth.vk.com/blank.html</code>, не наш callback.
            </p>
            <p className="text-xs text-muted-foreground">
              На сервере должен быть задан <code className="text-[11px]">NEXTAUTH_URL</code> с тем же доменом, что и
              в адресе выше (в Docker — в <code className="text-[11px]">.env</code>).
            </p>
          </div>
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
