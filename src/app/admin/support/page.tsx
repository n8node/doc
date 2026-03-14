"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Headphones,
  Loader2,
  Send,
  Settings,
  Tag,
  User,
  MessageSquare,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  sortOrder: number;
  isActive: boolean;
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
  user: { email: string; name: string | null };
  subject: string | null;
  status: TicketStatus;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Открыт",
  AWAITING_ADMIN: "Ожидает ответа",
  AWAITING_USER: "Ожидает пользователя",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решён",
  CLOSED: "Закрыт",
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

export default function AdminSupportPage() {
  const [tab, setTab] = useState<"tickets" | "themes">("tickets");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeSlug, setNewThemeSlug] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);

  const loadThemes = useCallback(() => {
    fetch("/api/v1/admin/support/themes", { credentials: "include" })
      .then((r) => r.json())
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);

  const loadTickets = useCallback(() => {
    fetch("/api/v1/admin/support/tickets", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/v1/admin/support/themes", { credentials: "include" }).then(
        (r) => r.json()
      ),
      fetch("/api/v1/admin/support/tickets", { credentials: "include" }).then(
        (r) => r.json()
      ),
    ])
      .then(([themesData, ticketsData]) => {
        setThemes(Array.isArray(themesData) ? themesData : []);
        setTickets(Array.isArray(ticketsData) ? ticketsData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReply = async () => {
    if (!selectedTicket || !replyBody.trim()) return;
    if (selectedTicket.status === "RESOLVED" || selectedTicket.status === "CLOSED") {
      toast.error("Тикет закрыт");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/admin/support/tickets/${selectedTicket.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ body: replyBody.trim() }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      const updated = await res.json();
      setSelectedTicket(updated);
      setReplyBody("");
      loadTickets();
      toast.success("Ответ отправлен. Пользователь получит уведомление и email.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSending(false);
    }
  };

  const handleAddTheme = async () => {
    if (!newThemeName.trim()) {
      toast.error("Введите название темы");
      return;
    }
    setSavingTheme(true);
    try {
      const res = await fetch("/api/v1/admin/support/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newThemeName.trim(),
          slug: newThemeSlug.trim() || undefined,
          sortOrder: themes.length,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Тема добавлена");
      setNewThemeName("");
      setNewThemeSlug("");
      loadThemes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingTheme(false);
    }
  };

  const handleToggleThemeActive = async (theme: Theme) => {
    try {
      const res = await fetch(`/api/v1/admin/support/themes/${theme.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !theme.isActive }),
      });
      if (!res.ok) throw new Error("Ошибка");
      loadThemes();
      toast.success(theme.isActive ? "Тема скрыта" : "Тема активирована");
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Ошибка");
      const updated = await res.json();
      if (selectedTicket?.id === ticketId) setSelectedTicket(updated);
      loadTickets();
      toast.success("Статус обновлён");
    } catch {
      toast.error("Ошибка");
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
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setTab("tickets")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "tickets"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-surface2"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Тикеты
        </button>
        <button
          type="button"
          onClick={() => setTab("themes")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "themes"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-surface2"
          )}
        >
          <Tag className="h-4 w-4" />
          Темы тикетов
        </button>
      </div>

      {tab === "tickets" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Список тикетов
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Нет тикетов</p>
              ) : (
                <ul className="space-y-1">
                  {tickets.map((t) => (
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
                          <User className="h-4 w-4 shrink-0" />
                          <span className="font-medium truncate">
                            {t.user.email}
                          </span>
                          {t.status === "AWAITING_ADMIN" && (
                            <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.theme.name} · {formatDate(t.updatedAt)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedTicket ? (
              <>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {selectedTicket.theme.name}
                      {selectedTicket.subject && ` — ${selectedTicket.subject}`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) =>
                          handleUpdateStatus(
                            selectedTicket.id,
                            e.target.value as TicketStatus
                          )
                        }
                        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
                      >
                        {(
                          Object.entries(STATUS_LABELS) as [TicketStatus, string][]
                        ).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {selectedTicket.user.email}
                    {selectedTicket.user.name && ` (${selectedTicket.user.name})`}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {selectedTicket.messages.map((m) => (
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
                          {m.authorRole === "ADMIN" ? "Вы" : "Пользователь"}
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
                          placeholder="Введите ответ..."
                          rows={3}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
                        />
                        <Button
                          onClick={handleReply}
                          disabled={sending || !replyBody.trim()}
                        >
                          {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Отправить ответ
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Пользователь получит in-app уведомление и email
                        </p>
                      </div>
                    )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                <p>Выберите тикет</p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {tab === "themes" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Темы тикетов
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Темы отображаются в выпадающем списке при создании тикета
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Название темы (например: Финансы)"
                value={newThemeName}
                onChange={(e) => setNewThemeName(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="slug (опционально)"
                value={newThemeSlug}
                onChange={(e) => setNewThemeSlug(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={handleAddTheme}
                disabled={savingTheme || !newThemeName.trim()}
              >
                {savingTheme ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Добавить
              </Button>
            </div>

            <ul className="divide-y divide-border">
              {themes.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 first:pt-0"
                >
                  <div>
                    <span
                      className={cn(
                        "font-medium",
                        !t.isActive && "text-muted-foreground line-through"
                      )}
                    >
                      {t.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {t.slug}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleThemeActive(t)}
                  >
                    {t.isActive ? "Скрыть" : "Активировать"}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
