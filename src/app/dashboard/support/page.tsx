"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Headphones,
  Loader2,
  Plus,
  Send,
  Bell,
  Clock,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TicketStatus =
  | "OPEN"
  | "AWAITING_ADMIN"
  | "AWAITING_USER"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

interface Theme {
  id: string;
  name: string;
  slug: string;
}

interface Message {
  id: string;
  authorRole: "USER" | "ADMIN";
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  theme: { name: string; slug: string };
  subject: string | null;
  status: TicketStatus;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: typeof Clock; badge: string | null; className: string }
> = {
  OPEN: { label: "Открыт", icon: Clock, badge: null, className: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
  AWAITING_ADMIN: {
    label: "В ожидании ответа",
    icon: Clock,
    badge: null,
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  AWAITING_USER: {
    label: "Есть ответ",
    icon: Bell,
    badge: "Ответ от поддержки",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  IN_PROGRESS: {
    label: "В работе",
    icon: Clock,
    badge: null,
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  RESOLVED: {
    label: "Решён",
    icon: CheckCircle,
    badge: null,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  CLOSED: {
    label: "Закрыт",
    icon: CheckCircle,
    badge: null,
    className: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  },
};

function getStatusConfig(status: string) {
  const cfg = STATUS_CONFIG[status as TicketStatus];
  return cfg ?? STATUS_CONFIG.AWAITING_ADMIN;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const searchParams = useSearchParams();
  const ticketIdFromUrl = searchParams.get("ticket");

  const [themes, setThemes] = useState<Theme[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);

  const [createThemeId, setCreateThemeId] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const loadThemes = useCallback(() => {
    fetch("/api/v1/support/themes", { credentials: "include" })
      .then((r) => r.json())
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);

  const loadTickets = useCallback(() => {
    return fetch("/api/v1/support/tickets", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setTickets(Array.isArray(data) ? data : []);
        if (ticketIdFromUrl && Array.isArray(data)) {
          const t = data.find((x: Ticket) => x.id === ticketIdFromUrl);
          if (t) setSelectedTicket(t);
        }
      })
      .catch(() => setTickets([]));
  }, [ticketIdFromUrl]);

  useEffect(() => {
    setLoading(true);
    loadThemes();
    loadTickets().finally(() => setLoading(false));
  }, [loadThemes, loadTickets]);

  const handleCreate = async () => {
    if (!createThemeId || !createBody.trim()) {
      toast.error("Выберите тему и введите сообщение");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ themeId: createThemeId, body: createBody.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      const ticket = await res.json();
      toast.success("Тикет создан");
      setShowCreate(false);
      setCreateThemeId("");
      setCreateBody("");
      loadTickets();
      setSelectedTicket(ticket);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyBody.trim()) return;
    if (selectedTicket.status === "RESOLVED" || selectedTicket.status === "CLOSED") {
      toast.error("Тикет закрыт");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/v1/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      const updated = await res.json();
      setSelectedTicket(updated);
      setReplyBody("");
      loadTickets();
      toast.success("Сообщение отправлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            Поддержка
          </h1>
          <p className="text-muted-foreground mt-1">
            Создайте тикет или продолжите переписку
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Создать тикет
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новый тикет</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Тема</label>
              <select
                value={createThemeId}
                onChange={(e) => setCreateThemeId(e.target.value)}
                className="h-10 w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Выберите тему</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Сообщение</label>
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                placeholder="Опишите вашу проблему или вопрос..."
                rows={4}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Создать
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Мои тикеты</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Нет тикетов. Создайте первый.
              </p>
            ) : (
              <ul className="space-y-1">
                {tickets.map((t) => {
                  const cfg = getStatusConfig(t.status);
                  const Icon = cfg.icon;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors",
                          selectedTicket?.id === t.id
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "hover:bg-surface2"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium truncate">{t.theme?.name}</span>
                          {cfg.badge && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              {cfg.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(t.updatedAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedTicket.theme?.name}
                    {selectedTicket.subject && ` — ${selectedTicket.subject}`}
                  </CardTitle>
                  {(() => {
                    const statusCfg = getStatusConfig(selectedTicket.status);
                    const StatusIcon = statusCfg.icon;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusCfg.className
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {(selectedTicket.messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-4 py-3",
                        m.authorRole === "ADMIN"
                          ? "bg-primary/10 border border-primary/20 ml-4"
                          : "bg-surface2 mr-4"
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        {m.authorRole === "ADMIN" ? "Поддержка" : "Вы"}
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>

                {selectedTicket.status !== "RESOLVED" &&
                  selectedTicket.status !== "CLOSED" && (
                    <div className="pt-4 border-t">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Введите сообщение..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
                      />
                      <Button onClick={handleReply} disabled={sending || !replyBody.trim()}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Отправить
                      </Button>
                    </div>
                  )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
              <p>Выберите тикет или создайте новый</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
