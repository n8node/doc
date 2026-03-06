"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Crown, HardDrive, ChevronRight, Sun, Moon, Monitor, Share2, Trash2, Bell, TriangleAlert } from "lucide-react";
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
  const [notificationPrefs, setNotificationPrefs] = useState({
    storage: true,
    trash: true,
    payment: true,
    aiTask: true,
    quota: true,
    shareLink: true,
  });
  const [savingNotificationPrefs, setSavingNotificationPrefs] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    fetch("/api/v1/user/me")
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
      fetch("/api/v1/user/storage").then((r) => r.json()),
      fetch("/api/v1/user/payments").then((r) => r.json()),
      fetch("/api/v1/share").then((r) => r.json()),
    ]).then(([storageRes, paymentsRes, shareRes]) => {
      if (storageRes.storageUsed !== undefined) setStorageData(storageRes);
      if (Array.isArray(paymentsRes.payments)) setPayments(paymentsRes.payments);
      if (Array.isArray(shareRes.links)) setShareLinks(shareRes.links);
    });
  }, []);

  useEffect(() => {
    fetch("/api/v1/user/preferences")
      .then((r) => r.json())
      .then((d) => {
        if (d.theme) {
          setSavedTheme(d.theme);
          setTheme(d.theme);
        }
        if (typeof d.emailNotifications === "boolean") {
          setEmailNotifications(d.emailNotifications);
        }
        if (d.notifications && typeof d.notifications === "object") {
          const n = d.notifications as Record<string, boolean>;
          setNotificationPrefs((p) => ({
            ...p,
            ...(typeof n.storage === "boolean" && { storage: n.storage }),
            ...(typeof n.trash === "boolean" && { trash: n.trash }),
            ...(typeof n.payment === "boolean" && { payment: n.payment }),
            ...(typeof n.aiTask === "boolean" && { aiTask: n.aiTask }),
            ...(typeof n.quota === "boolean" && { quota: n.quota }),
            ...(typeof n.shareLink === "boolean" && { shareLink: n.shareLink }),
          }));
        }
      })
      .catch(() => {});
  }, [setTheme]);

  const handleRevokeShareLink = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/share/${id}`, { method: "DELETE" });
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
      await fetch("/api/v1/user/preferences", {
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
      const res = await fetch("/api/v1/user/account", {
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
      await fetch("/api/v1/user/preferences", {
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
      const res = await fetch("/api/v1/user/profile", {
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
      const res = await fetch("/api/v1/user/password", {
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
            Управление уведомлениями в интерфейсе и по email
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Email</p>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={emailNotifications}
                disabled={savingNotifications}
                onChange={(e) => handleEmailNotificationsChange(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Получать уведомления на email</span>
            </label>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Уведомления в приложении (колокольчик)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Показывать уведомления о:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "storage" as const, label: "Хранилище (заполненность)" },
                { key: "trash" as const, label: "Корзина" },
                { key: "payment" as const, label: "Оплата и подписка" },
                { key: "aiTask" as const, label: "AI анализ и транскрипция" },
                { key: "quota" as const, label: "Лимиты (токены, минуты)" },
                { key: "shareLink" as const, label: "Публичные ссылки" },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notificationPrefs[key]}
                    disabled={savingNotificationPrefs}
                    onChange={async (e) => {
                      const v = e.target.checked;
                      setNotificationPrefs((p) => ({ ...p, [key]: v }));
                      setSavingNotificationPrefs(true);
                      try {
                        const res = await fetch("/api/v1/user/preferences", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            notifications: { ...notificationPrefs, [key]: v },
                          }),
                        });
                        if (!res.ok) throw new Error("Ошибка");
                        toast.success("Сохранено");
                      } catch {
                        setNotificationPrefs((p) => ({ ...p, [key]: !v }));
                        toast.error("Не удалось сохранить");
                      } finally {
                        setSavingNotificationPrefs(false);
                      }
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
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
