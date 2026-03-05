"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Shield,
  Ban,
  HardDrive,
  FileUp,
  FolderOpen,
  Link2,
  CreditCard,
  Calendar,
  Clock,
  File,
} from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isBlocked: boolean;
  blockedAt: string | null;
  lastLoginAt: string | null;
  storageUsed: number;
  storageQuota: number;
  maxFileSize: number;
  plan: { id: string; name: string; isFree: boolean } | null;
  createdAt: string;
  updatedAt: string;
  filesCount: number;
  foldersCount: number;
  shareLinksCount: number;
  paymentsCount: number;
  topFiles: { id: string; name: string; size: number; mimeType: string; createdAt: string }[];
}

interface PlanOption {
  id: string;
  name: string;
}

interface UserDetailDialogProps {
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function UserDetailDialog({ userId, onClose, onUpdated }: UserDetailDialogProps) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/admin/users/${userId}`).then((r) => r.json()),
      fetch("/api/v1/admin/plans").then((r) => r.json()),
    ])
      .then(([userData, plansData]) => {
        if (userData.id) {
          setUser(userData);
          setSelectedPlanId(userData.plan?.id ?? "none");
        }
        if (plansData.plans) {
          setPlans(plansData.plans.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => toast.error("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleChangePlan = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId === "none" ? null : selectedPlanId }),
      });
      if (res.ok) {
        toast.success("Тариф изменён");
        const updated = await fetch(`/api/v1/admin/users/${user.id}`).then((r) => r.json());
        if (updated.id) setUser(updated);
        onUpdated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pct =
    user && user.storageQuota > 0
      ? Math.min(Math.round((user.storageUsed / user.storageQuota) * 100), 100)
      : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <p className="py-12 text-center text-muted-foreground">Пользователь не найден</p>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    {user.name || user.email.split("@")[0]}
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                      {user.role === "ADMIN" && <Shield className="mr-0.5 h-2.5 w-2.5" />}
                      {user.role}
                    </Badge>
                    {user.isBlocked && (
                      <Badge variant="error" className="text-[10px]">
                        <Ban className="mr-0.5 h-2.5 w-2.5" />
                        Заблокирован
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-4 space-y-5">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Регистрация</p>
                    <p className="font-medium">{formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Последний вход</p>
                    <p className="font-medium">{formatDate(user.lastLoginAt)}</p>
                  </div>
                </div>
              </div>

              {/* Storage */}
              <div className="rounded-xl border border-border bg-surface2/20 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <HardDrive className="h-4 w-4 text-primary" />
                    Хранилище
                  </span>
                  <span className="text-sm">
                    {formatBytes(user.storageUsed)} / {formatBytes(user.storageQuota)}
                    <span className="ml-2 text-xs text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <div
                    className={`h-full rounded-full ${pct > 90 ? "bg-error" : pct > 70 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.max(pct, user.storageUsed > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <div className="mt-3 flex gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileUp className="h-3 w-3" />
                    Макс. файл: {formatBytes(user.maxFileSize)}
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-border p-3 text-center">
                  <File className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-bold">{user.filesCount}</p>
                  <p className="text-[10px] text-muted-foreground">Файлов</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <FolderOpen className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-bold">{user.foldersCount}</p>
                  <p className="text-[10px] text-muted-foreground">Папок</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <Link2 className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-bold">{user.shareLinksCount}</p>
                  <p className="text-[10px] text-muted-foreground">Ссылок</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <CreditCard className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-bold">{user.paymentsCount}</p>
                  <p className="text-[10px] text-muted-foreground">Платежей</p>
                </div>
              </div>

              {/* Change plan */}
              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 text-sm font-medium">Тариф</p>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="none">Без тарифа</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={handleChangePlan}
                    disabled={saving || selectedPlanId === (user.plan?.id ?? "none")}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
                  </Button>
                </div>
              </div>

              {/* Top files */}
              {user.topFiles.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Крупнейшие файлы</p>
                  <div className="space-y-1.5">
                    {user.topFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg bg-surface2/30 px-3 py-2 text-xs">
                        <span className="truncate font-medium">{f.name}</span>
                        <span className="ml-3 shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
