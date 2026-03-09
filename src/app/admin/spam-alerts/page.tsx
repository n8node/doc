"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

interface AlertItem {
  id: string;
  severity: "WARNING" | "CRITICAL";
  score: number;
  registrationsCount: number;
  verificationRate: number;
  activityRate: number;
  uniqueDomains: number;
  windowStart: string;
  windowEnd: string;
  sentToTelegram: boolean;
  createdAt: string;
  reasons: string[];
  domains: string[];
  rootUser: {
    id: string;
    email: string;
    name: string | null;
    isBlocked: boolean;
  } | null;
}

export default function AdminSpamAlertsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [sentToTelegram, setSentToTelegram] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      if (severity) params.set("severity", severity);
      if (sentToTelegram) params.set("sentToTelegram", sentToTelegram);

      const res = await fetch(`/api/v1/admin/spam-alerts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки инцидентов");

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setTotalPages(Number(data.totalPages || 1));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка загрузки инцидентов"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, severity, sentToTelegram]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Антиспам-инциденты</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Срабатывания детектора спам-регистраций по инвайт-связкам
          </p>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Всего инцидентов</p>
          <p className="mt-2 text-2xl font-bold">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">На странице</p>
          <p className="mt-2 text-2xl font-bold">{items.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Текущая страница</p>
          <p className="mt-2 text-2xl font-bold">
            {page}/{Math.max(1, totalPages)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по email/имени корня связки..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все severity</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <select
            value={sentToTelegram}
            onChange={(e) => {
              setSentToTelegram(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Любая отправка</option>
            <option value="true">Отправлено в Telegram</option>
            <option value="false">Не отправлено</option>
          </select>
          <Button
            onClick={() => {
              setPage(1);
              loadData();
            }}
          >
            Применить
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Severity</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Корень связки</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Метрики</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Причины</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Окно</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Telegram</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      Инциденты не найдены
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 align-top">
                      <td className="px-3 py-2">
                        {row.severity === "CRITICAL" ? (
                          <Badge variant="error">CRITICAL</Badge>
                        ) : (
                          <Badge variant="warning">WARNING</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold">{row.score}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.rootUser?.email ?? "Неизвестно"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.rootUser?.isBlocked ? "Заблокирован" : "Активен"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>Регистраций: {row.registrationsCount}</div>
                        <div>Email verify: {Math.round(row.verificationRate * 100)}%</div>
                        <div>Активность: {Math.round(row.activityRate * 100)}%</div>
                        <div>Доменов: {row.uniqueDomains}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.reasons.length > 0 ? row.reasons.join("; ") : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{formatDate(row.windowStart)}</div>
                        <div className="text-muted-foreground">{formatDate(row.windowEnd)}</div>
                      </td>
                      <td className="px-3 py-2">
                        {row.sentToTelegram ? (
                          <Badge variant="success">Отправлено</Badge>
                        ) : (
                          <Badge variant="secondary">Нет</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          {row.rootUser?.email ? (
                            <>
                              <Link
                                href={`/admin/users?search=${encodeURIComponent(row.rootUser.email)}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Открыть в пользователях
                              </Link>
                              <Link
                                href={`/admin/invites?search=${encodeURIComponent(row.rootUser.email)}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Открыть в инвайтах
                              </Link>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Стр. {page} из {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
