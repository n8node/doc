"use client";

import { useState, useEffect } from "react";
import { X, Link2 } from "lucide-react";

const STORAGE_KEY = "doc_notification_banner";
const RELOAD_KEY = "doc_reload_count";

interface Notification {
  id: string;
  message: string;
  link?: string;
  linkText?: string;
}

function getReloadCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(RELOAD_KEY);
  const n = parseInt(raw ?? "0", 10);
  sessionStorage.setItem(RELOAD_KEY, String(n + 1));
  return n + 1;
}

function getHiddenState(): Record<string, { hiddenAtLoad: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setHiddenState(state: Record<string, { hiddenAtLoad: number }>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function NotificationBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/v1/user/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const items: Notification[] = [];
        const al = data.accountLinking;
        if (al?.canLinkTelegram) {
          items.push({
            id: "link_telegram",
            message: "Привяжите Telegram для входа по QR и кнопке",
            link: "/dashboard/settings",
            linkText: "Настроить",
          });
        }
        if (al?.canLinkEmail) {
          items.push({
            id: "link_email",
            message: "Привяжите email для входа по паролю",
            link: "/dashboard/settings",
            linkText: "Настроить",
          });
        }
        setNotifications(items);

        const reloadCount = getReloadCount();
        const hidden = getHiddenState();
        const vis: Record<string, boolean> = {};
        items.forEach((n) => {
          const h = hidden[n.id];
          if (!h) {
            vis[n.id] = true;
          } else {
            vis[n.id] = reloadCount - h.hiddenAtLoad >= 5;
          }
        });
        setVisible(vis);
      })
      .catch(() => setNotifications([]))
      .finally(() => mounted && (setLoading(false), undefined));
    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = (id: string) => {
    const reloadCount = getReloadCount();
    const hidden = getHiddenState();
    hidden[id] = { hiddenAtLoad: reloadCount };
    setHiddenState(hidden);
    setVisible((v) => ({ ...v, [id]: false }));
  };

  const toShow = notifications.filter((n) => visible[n.id]);

  if (loading || toShow.length === 0) return null;

  return (
    <div className="space-y-2">
      {toShow.map((n) => (
        <div
          key={n.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm">{n.message}</span>
            {n.link && (
              <a
                href={n.link}
                className="shrink-0 text-sm font-medium text-amber-700 underline hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
              >
                {n.linkText ?? "Перейти"}
              </a>
            )}
          </div>
          <button
            onClick={() => handleDismiss(n.id)}
            className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            aria-label="Скрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
