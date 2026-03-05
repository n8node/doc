"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Crown, HardDrive, ChevronRight, Sun, Moon, Monitor, Share2, Trash2, Bell, TriangleAlert, Key, Copy, ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatBytes } from "@/lib/utils";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  preferences?: Record<string, unknown>;
}

interface StorageData {
  storageUsed: number;
  storageQuota: number;
  maxFileSize: number;
  filesCount: number;
  plan: { id: string; name: string; isFree: boolean };
  nextPlan: { id: string; name: string; priceMonthly: number | null; storageQuota: number } | null;
}

interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  plan: { id: string; name: string };
}

interface ShareLinkItem {
  id: string;
  token: string;
  targetType: string;
  fileId: string | null;
  folderId: string | null;
  expiresAt: string | null;
  oneTime: boolean;
  file: { id: string; name: string } | null;
  folder: { id: string; name: string } | null;
  createdAt: string;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function DashboardSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLinkItem[]>([]);
  const [savedTheme, setSavedTheme] = useState<string>("system");
  const [savingTheme, setSavingTheme] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    fetch("/api/user/me")
      .then(async (r) => {
        let data: { error?: string };
        try {
          data = await r.json();
        } catch {
          throw new Error(r.status === 500 ? "Ошибка сервера (проверьте БД и логи)" : `Ошибка ${r.status}`);
        }
        if (!r.ok || data.error) throw new Error(data.error ?? "Ошибка загрузки профиля");
        return data as ProfileData;
      })
      .then((data) => {
        setProfile(data);
        setName(data.name ?? "");
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Ошибка загрузки профиля"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/storage").then((r) => r.json()),
      fetch("/api/user/payments").then((r) => r.json()),
      fetch("/api/share").then((r) => r.json()),
    ]).then(([storageRes, paymentsRes, shareRes]) => {
      if (storageRes.storageUsed !== undefined) setStorageData(storageRes);
      if (Array.isArray(paymentsRes.payments)) setPayments(paymentsRes.payments);
      if (Array.isArray(shareRes.links)) setShareLinks(shareRes.links);
    });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/api-keys").then((r) => r.json()),
      fetch("/api/user/api-info").then((r) => r.json()),
    ]).then(([keysRes, infoRes]) => {
      if (Array.isArray(keysRes.keys)) setApiKeys(keysRes.keys);
      if (infoRes.baseUrl) setBaseUrl(infoRes.baseUrl);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((d) => {
        if (d.theme) {
          setSavedTheme(d.theme);
          setTheme(d.theme);
        }
        if (typeof d.emailNotifications === "boolean") {
          setEmailNotifications(d.emailNotifications);
        }
      })
      .catch(() => {});
  }, [setTheme]);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newKeyName.trim() || "API Key";
    setCreatingKey(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка создания ключа");
      setApiKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix,
          lastUsedAt: null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewKeyName("");
      setNewKeyValue(data.key ?? null);
      toast.success("API ключ создан. Сохраните его — он больше не будет показан.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка создания ключа");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    setDeletingKeyId(id);
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка удаления");
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Ключ удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления ключа");
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleCopyKey = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success("Ключ скопирован");
  };

  const handleRevokeShareLink = async (id: string) => {
    try {
      const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка отзыва");
      setShareLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success("Ссылка отозвана");
    } catch {
      toast.error("Не удалось отозвать ссылку");
    }
  };

  const handleEmailNotificationsChange = async (checked: boolean) => {
    setEmailNotifications(checked);
    setSavingNotifications(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: checked }),
      });
      toast.success(checked ? "Уведомления включены" : "Уведомления отключены");
    } catch {
      setEmailNotifications(!checked);
      toast.error("Не удалось сохранить");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirm !== "УДАЛИТЬ" || !deletePassword) {
      toast.error('Введите пароль и напишите "УДАЛИТЬ" для подтверждения');
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка удаления");
      toast.success("Аккаунт удалён");
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления аккаунта");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleThemeChange = async (value: string) => {
    setTheme(value);
    setSavedTheme(value);
    setSavingTheme(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
    } finally {
      setSavingTheme(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      setProfile((p) => (p ? { ...p, name: data.name } : null));
      toast.success("Профиль обновлён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Пароль должен быть не менее 8 символов");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка смены пароля");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль успешно изменён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка смены пароля");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      <h1 className="col-span-full text-2xl font-semibold text-foreground">Настройки</h1>

      {/* Профиль */}
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <p className="text-sm text-muted-foreground">
            Имя и email вашего аккаунта
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="settings-name"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Имя
              </label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="max-w-md"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <p className="text-sm text-muted-foreground">
                {profile?.email ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Email используется для входа и не редактируется здесь
              </p>
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </form>
        </CardContent>
      </div>

      {/* Безопасность */}
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Безопасность</CardTitle>
          <p className="text-sm text-muted-foreground">
            Смена пароля и информация о входе
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile?.lastLoginAt && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Последний вход
              </label>
              <p className="text-sm text-muted-foreground">
                {new Date(profile.lastLoginAt).toLocaleString("ru-RU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label
                htmlFor="current-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Текущий пароль
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="max-w-md"
                required
              />
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Новый пароль
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Не менее 8 символов"
                className="max-w-md"
                minLength={8}
                required
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Подтверждение пароля
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                className="max-w-md"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Сменить пароль
            </Button>
          </form>
        </CardContent>
      </div>

      {/* API ключи */}
      <div className="rounded-2xl modal-glass overflow-hidden lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API ключи
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Используйте API ключи для интеграции с внешними сервисами (n8n, скрипты и т.д.).
            Указывайте ключ в заголовке <code className="rounded bg-surface2 px-1">Authorization: Bearer &lt;key&gt;</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {baseUrl && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Базовый URL API
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={baseUrl}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyKey(baseUrl)}
                  title="Копировать"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Создать новый ключ
            </label>
            <form onSubmit={handleCreateApiKey} className="flex gap-2">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Например: n8n интеграция"
                className="max-w-xs"
              />
              <Button type="submit" disabled={creatingKey}>
                {creatingKey && <Loader2 className="h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </form>
          </div>
          {newKeyValue && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                Сохраните ключ — он больше не будет показан
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-surface2 px-2 py-1 text-sm font-mono">
                  {newKeyValue}
                </code>
                <Button variant="outline" size="sm" onClick={() => handleCopyKey(newKeyValue)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNewKeyValue(null)}>
                  Закрыть
                </Button>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Ваши ключи
            </label>
            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Нет активных ключей
              </p>
            ) : (
              <ul className="space-y-2">
                {apiKeys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{k.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {k.keyPrefix}
                        {k.lastUsedAt
                          ? ` · Использован ${new Date(k.lastUsedAt).toLocaleString("ru-RU")}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={deletingKeyId === k.id}
                      onClick={() => handleDeleteApiKey(k.id)}
                    >
                      {deletingKeyId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Удалить
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/dashboard/api-docs"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")}
          >
            Документация API
            <ExternalLink className="h-4 w-4" />
          </Link>
        </CardContent>
      </div>

      {/* Подписка и хранилище */}
      {storageData && (
        <>
          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Подписка
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Текущий тариф и использование
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{storageData.plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {storageData.plan.isFree ? "Бесплатный тариф" : "Платный тариф"}
                  </p>
                </div>
                <Link
                  href="/dashboard/plans"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}
                >
                  Сменить тариф
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </div>

          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Хранилище
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Использовано {formatBytes(storageData.storageUsed)} из {formatBytes(storageData.storageQuota)}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (storageData.storageUsed / storageData.storageQuota) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Файлов: {storageData.filesCount} · Макс. размер файла:{" "}
                {formatBytes(storageData.maxFileSize)}
              </p>
            </CardContent>
          </div>

          {payments.length > 0 && (
            <div className="rounded-2xl modal-glass overflow-hidden">
              <CardHeader>
                <CardTitle>История платежей</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Последние платежи по подписке
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Дата</th>
                        <th className="pb-2 pr-4 font-medium">Тариф</th>
                        <th className="pb-2 pr-4 font-medium">Сумма</th>
                        <th className="pb-2 font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-border/70">
                          <td className="py-3 pr-4 text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 pr-4">{p.plan.name}</td>
                          <td className="py-3 pr-4">
                            {p.amount} {p.currency}
                          </td>
                          <td className="py-3">
                            {p.status === "succeeded"
                              ? "Оплачено"
                              : p.status === "pending"
                                ? "Ожидание"
                                : p.status === "canceled"
                                  ? "Отменён"
                                  : p.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </div>
          )}
        </>
      )}

      {/* Ссылки доступа */}
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Ссылки доступа
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Публичные ссылки на файлы и папки. Отзовите ссылку, чтобы она перестала работать.
          </p>
        </CardHeader>
        <CardContent>
          {shareLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              У вас пока нет активных ссылок. Создайте ссылку в разделе «Мои файлы» через меню «Поделиться».
            </p>
          ) : (
            <ul className="space-y-3">
              {shareLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2/50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {link.targetType === "FILE"
                        ? link.file?.name ?? "Файл"
                        : link.folder?.name ?? "Папка"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {link.targetType === "FILE" ? "Файл" : "Папка"}
                      {link.expiresAt
                        ? ` · Истекает ${new Date(link.expiresAt).toLocaleDateString("ru-RU")}`
                        : ""}
                      {link.oneTime ? " · Одноразовая" : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevokeShareLink(link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Отозвать
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </div>

      {/* Уведомления */}
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Уведомления
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Email-уведомления о важных событиях (оплата, смена пароля и т.д.)
          </p>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={emailNotifications}
              disabled={savingNotifications}
              onChange={(e) => handleEmailNotificationsChange(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Получать уведомления на email</span>
          </label>
        </CardContent>
      </div>

      {/* Внешний вид — тема */}
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Внешний вид</CardTitle>
          <p className="text-sm text-muted-foreground">
            Тема интерфейса (светлая, тёмная или как в системе)
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "light", label: "Светлая", icon: Sun },
              { value: "dark", label: "Тёмная", icon: Moon },
              { value: "system", label: "Системная", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={savedTheme === value ? "default" : "outline"}
                size="sm"
                disabled={savingTheme}
                onClick={() => handleThemeChange(value)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </div>

      {/* Опасная зона */}
      <div className="rounded-2xl modal-glass overflow-hidden border-2 border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-5 w-5" />
            Опасная зона
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Удаление аккаунта необратимо. Все файлы, папки и данные будут удалены.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div>
              <label
                htmlFor="delete-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Ваш пароль
              </label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Введите пароль для подтверждения"
                className="max-w-md border-destructive/50"
                required
              />
            </div>
            <div>
              <label
                htmlFor="delete-confirm"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Напишите УДАЛИТЬ для подтверждения
              </label>
              <Input
                id="delete-confirm"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="УДАЛИТЬ"
                className="max-w-md border-destructive/50"
                required
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                deletingAccount ||
                deleteConfirm !== "УДАЛИТЬ" ||
                !deletePassword
              }
            >
              {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
              Удалить аккаунт
            </Button>
          </form>
        </CardContent>
      </div>
    </div>
  );
}
