"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellRing, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NotificationType =
  | "STORAGE"
  | "TRASH"
  | "PAYMENT"
  | "AI_TASK"
  | "QUOTA"
  | "SHARE_LINK"
  | "SUPPORT_TICKET";

interface NotificationItem {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  body: string | null;
  payload?: { ticketId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  STORAGE: "Хранилище",
  TRASH: "Корзина",
  PAYMENT: "Оплата",
  AI_TASK: "AI анализ",
  QUOTA: "Лимиты",
  SHARE_LINK: "Ссылки",
  SUPPORT_TICKET: "Поддержка",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (filterType !== "all") params.set("type", filterType);
    fetch(`/api/v1/notifications?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterType]);

  const handleClearAll = async () => {
    if (!confirm("Удалить все уведомления?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/v1/notifications", { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка");
      const d = await res.json();
      toast.success(`Удалено: ${d.deleted ?? 0}`);
      load();
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setClearing(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/v1/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Ошибка");
      toast.success("Все отмечены как прочитанные");
      load();
    } catch {
      toast.error("Не удалось обновить");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) =>
                n.id === id ? { ...n, readAt: new Date().toISOString() } : n
              ),
              unreadCount: Math.max(0, prev.unreadCount - 1),
            }
          : null
      );
    } catch {}
  };

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Уведомления</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Все прочитаны"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 w-[180px] rounded-lg border border-border bg-surface px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Все типы</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={markingAll}
              onClick={handleMarkAllRead}
            >
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : "Прочитать все"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={clearing || items.length === 0}
            onClick={handleClearAll}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Очистить
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Список</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-50" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-surface2/50 transition-colors cursor-pointer",
                    !n.readAt && "bg-surface2/30"
                  )}
                  onClick={() => {
                    if (!n.readAt) handleMarkRead(n.id);
                    if (n.type === "SUPPORT_TICKET" && n.payload?.ticketId) {
                      router.push(`/dashboard/support?ticket=${n.payload.ticketId}`);
                    }
                  }}
                >
                  <div className="mt-0.5">
                    {n.readAt ? (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <BellRing className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-surface2">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
