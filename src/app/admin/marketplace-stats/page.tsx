"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
  DollarSign,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StatsResponse {
  dateFrom: string;
  dateTo: string;
  revenueCents: number;
  revenueRub: number;
  requestsCount: number;
  openRouterUsageUsd: number;
  openRouterCostRub: number | null;
  blendedRateRubPerUsd: number | null;
  platformEarningsRub: number;
  activityError?: string | null;
}

function formatRub(n: number | null | undefined): string {
  if (n == null || typeof n !== "number") return "—";
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || typeof n !== "number") return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

export default function MarketplaceStatsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [useMonth, setUseMonth] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetSecretKey, setResetSecretKey] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (useMonth) {
        params.set("month", month);
      } else {
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
      }
      const res = await fetch(`/api/v1/admin/marketplace-stats?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Ошибка загрузки");
        setData(null);
        return;
      }
      setData(json as StatsResponse);
    } catch {
      setError("Ошибка соединения");
      setData(null);
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, month, useMonth]);

  const handleReset = useCallback(async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await fetch("/api/v1/admin/marketplace-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: resetSecretKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ошибка сброса");
      setResetDialogOpen(false);
      setResetSecretKey("");
      toast.success("Данные сброшены");
      void load();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Ошибка сброса");
    } finally {
      setResetLoading(false);
    }
  }, [resetSecretKey, load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Статистика маркетплейса LLM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Выручка, расходы OpenRouter, заработок платформы
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void load()} disabled={loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Обновить
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => {
              setResetError(null);
              setResetSecretKey("");
              setResetDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Сбросить данные
          </Button>
        </div>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-destructive">Сброс финансовых данных</DialogTitle>
            <DialogDescription>
              Будет удалено: usage маркетплейса, пополнения, token_usage, payments. Все пользователи переведутся на бесплатный план. API-ключи сохранятся. Действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">Секретный ключ</label>
              <Input
                type="password"
                placeholder="Введите ключ"
                value={resetSecretKey}
                onChange={(e) => setResetSecretKey(e.target.value)}
                className="max-w-xs"
                autoComplete="off"
              />
            </div>
            {resetError && (
              <p className="text-sm text-destructive">{resetError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetLoading}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReset()}
              disabled={resetLoading || !resetSecretKey}
              className="gap-2"
            >
              {resetLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Сбросить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useMonth}
            onChange={(e) => setUseMonth(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Месяц</span>
        </label>
        {useMonth ? (
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm">С</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">По</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <p className="text-xs text-muted-foreground">Макс. 31 день</p>
          </>
        )}
      </div>

      {data?.activityError && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                OpenRouter Activity: {data.activityError}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Настройте Management API ключ в{" "}
                <a
                  href="/admin/settings?tab=marketplace"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Настройки → Маркетплейс
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {!error && data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Период: {data.dateFrom} — {data.dateTo}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Выручка (руб)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatRub(data.revenueRub)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.requestsCount} списаний с пользователей
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Расход OpenRouter (USD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatUsd(data.openRouterUsageUsd)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Фактические списания с аккаунта
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Расход OpenRouter (руб)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatRub(data.openRouterCostRub)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.blendedRateRubPerUsd != null
                    ? `Курс ${data.blendedRateRubPerUsd.toFixed(2)} ₽/USD`
                    : "Добавьте партии в Финансы"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Заработок платформы (руб)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    data.platformEarningsRub >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatRub(data.platformEarningsRub)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Выручка − расход OpenRouter
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Сводная таблица</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface2/50">
                      <th className="px-4 py-2 text-left">Показатель</th>
                      <th className="px-4 py-2 text-right">Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Выручка платформы</td>
                      <td className="px-4 py-2 text-right font-medium">{formatRub(data.revenueRub)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Расход OpenRouter (USD)</td>
                      <td className="px-4 py-2 text-right font-medium">{formatUsd(data.openRouterUsageUsd)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Расход OpenRouter (руб)</td>
                      <td className="px-4 py-2 text-right font-medium">{formatRub(data.openRouterCostRub)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Заработок платформы</td>
                      <td
                        className={`px-4 py-2 text-right font-bold ${
                          data.platformEarningsRub >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatRub(data.platformEarningsRub)}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Запросов</td>
                      <td className="px-4 py-2 text-right">{data.requestsCount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
