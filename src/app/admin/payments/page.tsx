"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type TabType = "topup" | "refunds" | "tokens";

interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  yookassaPaymentId: string | null;
  user: { id: string; email: string; name: string | null };
  plan: { id: string; name: string };
}

interface TokenUsageItem {
  id: string;
  type: string;
  amount: number;
  unit: string;
  completedAt: string | null;
  user: { id: string; email: string; name: string | null };
  file: { id: string; name: string } | null;
  provider: { id: string; name: string } | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<TabType>("topup");
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [tokenItems, setTokenItems] = useState<TokenUsageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
      });
      if (tab === "topup") params.set("status", statusFilter || "succeeded,pending");
      if (tab === "refunds") params.set("status", statusFilter || "refunded,canceled");
      if (userSearch) params.set("user", userSearch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/v1/admin/payments?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPayments(data.payments ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      } else {
        toast.error(data.error || "Ошибка загрузки");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [tab, page, userSearch, dateFrom, dateTo, statusFilter]);

  const loadTokenUsage = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
      });
      if (typeFilter) params.set("type", typeFilter);
      if (userSearch) params.set("user", userSearch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/v1/admin/ai-usage?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTokenItems(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      } else {
        toast.error(data.error || "Ошибка загрузки");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [page, userSearch, dateFrom, dateTo, typeFilter]);

  useEffect(() => {
    if (tab === "topup" || tab === "refunds") {
      loadPayments();
    } else {
      loadTokenUsage();
    }
  }, [tab, loadPayments, loadTokenUsage]);

  const handleRefresh = () => {
    setPage(1);
    if (tab === "topup" || tab === "refunds") loadPayments();
    else loadTokenUsage();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "error" | "outline" }> = {
      succeeded: { label: "Оплачено", variant: "default" },
      pending: { label: "Ожидание", variant: "secondary" },
      canceled: { label: "Отменён", variant: "outline" },
      refunded: { label: "Возврат", variant: "error" },
    };
    const m = map[s] ?? { label: s, variant: "outline" as const };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">История платежей</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Пополнения, возвраты и траты токенов
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(
          [
            { id: "topup" as TabType, label: "Пополнения", icon: ArrowDownLeft },
            { id: "refunds" as TabType, label: "Списания / Возвраты", icon: ArrowUpRight },
            { id: "tokens" as TabType, label: "Траты токенов", icon: Zap },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setPage(1);
              if (id === "topup") setStatusFilter("succeeded");
              if (id === "refunds") setStatusFilter("refunded");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по email или имени..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Input
            type="date"
            placeholder="С"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-36"
          />
          <Input
            type="date"
            placeholder="По"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-36"
          />
          {(tab === "topup" || tab === "refunds") && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {tab === "topup" ? (
                <>
                  <option value="">Все пополнения</option>
                  <option value="succeeded">Оплачено</option>
                  <option value="pending">Ожидание</option>
                </>
              ) : (
                <>
                  <option value="">Все</option>
                  <option value="refunded">Возврат</option>
                  <option value="canceled">Отменено</option>
                </>
              )}
            </select>
          )}
          {tab === "tokens" && (
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Все типы</option>
              <option value="EMBEDDING">Эмбеддинг</option>
              <option value="TRANSCRIPTION">Транскрипция</option>
            </select>
          )}
          <span className="text-sm text-muted-foreground">Найдено: {total}</span>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (tab === "topup" || tab === "refunds") && payments.length === 0 ? (
        <Card className="p-12 text-center">
          <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Платежей не найдено</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Измените параметры поиска или выберите другой таб
          </p>
        </Card>
      ) : tab === "tokens" && tokenItems.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Записей не найдено</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Измените параметры поиска или выберите другой таб
          </p>
        </Card>
      ) : tab === "topup" || tab === "refunds" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Пользователь</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Тариф</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сумма</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Оплачено</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-surface2/20">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.user.name || p.user.email.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground">{p.user.email}</p>
                    </td>
                    <td className="px-4 py-3">{p.plan.name}</td>
                    <td className="px-4 py-3 font-medium">
                      {p.amount} {p.currency}
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Стр. {page} из {totalPages}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Пользователь</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Тип</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Объём</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Файл</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Провайдер</th>
                </tr>
              </thead>
              <tbody>
                {tokenItems.map((t) => (
                  <tr key={t.id} className="border-b border-border hover:bg-surface2/20">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(t.completedAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.user.name || t.user.email.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground">{t.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {t.type === "EMBEDDING" ? "Эмбеддинг" : "Транскрипция"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {t.amount.toLocaleString()} {t.unit === "tokens" ? "токенов" : "мин"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">
                      {t.file?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.provider?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Стр. {page} из {totalPages}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
