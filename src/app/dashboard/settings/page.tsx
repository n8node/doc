"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  preferences?: Record<string, unknown>;
}

export default function DashboardSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
    </div>
  );
}
