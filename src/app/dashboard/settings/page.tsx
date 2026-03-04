"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Crown, HardDrive, ChevronRight, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { formatBytes } from "@/lib/utils";

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
  const [savedTheme, setSavedTheme] = useState<string>("system");
  const [savingTheme, setSavingTheme] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProfile(data);
        setName(data.name ?? "");
      })
      .catch(() => toast.error("Ошибка загрузки профиля"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/storage").then((r) => r.json()),
      fetch("/api/user/payments").then((r) => r.json()),
    ]).then(([storageRes, paymentsRes]) => {
      if (storageRes.storageUsed !== undefined) setStorageData(storageRes);
      if (Array.isArray(paymentsRes.payments)) setPayments(paymentsRes.payments);
    });
  }, []);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((d) => {
        if (d.theme) {
          setSavedTheme(d.theme);
          setTheme(d.theme);
        }
      })
      .catch(() => {});
  }, [setTheme]);

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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Настройки</h1>

      {/* Профиль */}
      <Card>
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
      </Card>

      {/* Безопасность */}
      <Card>
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
      </Card>

      {/* Подписка и хранилище */}
      {storageData && (
        <>
          <Card>
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
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/plans" className="flex items-center gap-1">
                    Сменить тариф
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
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
          </Card>

          {payments.length > 0 && (
            <Card>
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
            </Card>
          )}
        </>
      )}

      {/* Внешний вид — тема */}
      <Card>
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
      </Card>
    </div>
  );
}
