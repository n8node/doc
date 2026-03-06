"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, BellRing, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "только что";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ч назад`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} дн назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/v1/notifications?limit=8")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
          aria-label="Уведомления"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[min(24rem,70vh)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Уведомления</span>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            Все
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Загрузка...
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Нет уведомлений
            </p>
          ) : (
            <div className="py-1">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href="/dashboard/notifications"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-2 hover:bg-surface2 transition-colors",
                    !n.readAt && "bg-surface2/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <BellRing className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
