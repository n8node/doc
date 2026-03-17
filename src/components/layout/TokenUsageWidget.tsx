"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, CreditCard, Gift, Sparkles, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryKey = "CHAT_DOCUMENT" | "SEARCH" | "EMBEDDING" | "TRANSCRIPTION";

interface TokenUsageResponse {
  anchorType: "registration" | "last_payment";
  cycleStart: string;
  cycleEnd: string;
  quotas: Record<CategoryKey, number | null>;
  total: {
    quota: number | null;
    used: number;
    remaining: number | null;
  };
  currentCycle: {
    byCategory: Record<CategoryKey, number>;
    byCategoryCount: Record<CategoryKey, number>;
  };
  sinceAnchor: {
    totalTokens: number;
    byCategory: Record<CategoryKey, number>;
  };
  recentEvents: Array<{
    id: string;
    category: CategoryKey;
    title: string;
    tokensTotal: number;
    createdAt: string;
  }>;
  daily: Array<{
    date: string;
    totalTokens: number;
    byCategory: Record<CategoryKey, number>;
  }>;
  freeVsPaid: {
    freeTokens: number;
    paidTokens: number;
    firstPaidAt: string | null;
  };
  /** Квота и использование генерации изображений за текущий месяц (цифры с наценкой). */
  imageGeneration?: {
    quota: number | null;
    used: number;
    count: number;
  };
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  CHAT_DOCUMENT: "Чат по документам",
  SEARCH: "Поиск",
  EMBEDDING: "Эмбеддинг",
  TRANSCRIPTION: "Транскрибация",
};

function formatNumber(n: number | null | undefined) {
  if (n == null) return "∞";
  return n.toLocaleString("ru-RU");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function shortNumber(n: number | null | undefined) {
  if (n == null) return "∞";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("ru-RU");
}

export function TokenUsageWidget() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenUsageResponse | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/user/token-usage", { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) {
        setData(payload);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, []);

  const tone = useMemo(() => {
    if (!data || data.total.quota == null || data.total.quota <= 0) return "normal";
    const ratio = (data.total.remaining ?? 0) / data.total.quota;
    if (ratio < 0.2) return "danger";
    if (ratio < 0.5) return "warn";
    return "ok";
  }, [data]);

  const pillToneClass =
    tone === "danger"
      ? "border-red-400/80 bg-gradient-to-r from-red-500/20 to-rose-500/15 text-slate-900 dark:text-red-50 shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_8px_24px_rgba(220,38,38,0.2)]"
      : tone === "warn"
        ? "border-amber-400/80 bg-gradient-to-r from-amber-400/20 to-orange-400/15 text-slate-900 dark:text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_8px_20px_rgba(245,158,11,0.18)]"
        : tone === "ok"
          ? "border-emerald-400/80 bg-gradient-to-r from-emerald-400/20 to-cyan-400/15 text-slate-900 dark:text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_8px_20px_rgba(16,185,129,0.18)]"
          : "border-border bg-gradient-to-r from-surface2 to-surface text-foreground";

  const usagePercent = useMemo(() => {
    if (!data?.total.quota || data.total.quota <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((data.total.used / data.total.quota) * 100)));
  }, [data]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`hidden md:flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-xs transition-all hover:scale-[1.01] hover:brightness-110 ${pillToneClass}`}
      >
        <div className="rounded-lg bg-white/35 dark:bg-white/15 p-1.5">
          <Zap className="h-4 w-4" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-[10px] opacity-100">По тарифу</div>
          <div className="font-semibold tracking-wide">{loading ? "..." : shortNumber(data?.total.quota)}</div>
        </div>
        <div className="h-7 w-px bg-slate-500/30 dark:bg-white/30" />
        <div className="text-left leading-tight">
          <div className="text-[10px] opacity-100">Осталось</div>
          <div className="font-semibold tracking-wide">{loading ? "..." : shortNumber(data?.total.remaining)}</div>
        </div>
        <div className="w-20">
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-slate-500/30 dark:bg-black/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 dark:from-cyan-300 dark:to-emerald-300 transition-all"
              style={{ width: `${Math.max(4, 100 - usagePercent)}%` }}
            />
          </div>
          <p className="text-[10px] opacity-100 text-right">{usagePercent}% использ.</p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Статистика токенов</DialogTitle>
          </DialogHeader>

          {!data ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-surface2/40 p-4 text-sm">
                <p className="font-medium">
                  Текущий период: {formatDate(data.cycleStart)} - {formatDate(data.cycleEnd)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Точка отсчета: {data.anchorType === "registration" ? "с даты регистрации" : "с последней оплаты"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Лимит</p>
                  <p className="text-lg font-semibold">{formatNumber(data.total.quota)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Потрачено</p>
                  <p className="text-lg font-semibold">{formatNumber(data.total.used)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Осталось</p>
                  <p className="text-lg font-semibold">{formatNumber(data.total.remaining)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 text-sm font-medium">Бесплатные vs платные токены</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3">
                    <p className="flex items-center gap-2 text-xs text-emerald-300">
                      <Gift className="h-4 w-4" />
                      Бесплатные токены
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(data.freeVsPaid.freeTokens)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-300/30 bg-sky-500/10 p-3">
                    <p className="flex items-center gap-2 text-xs text-sky-300">
                      <CreditCard className="h-4 w-4" />
                      Платные токены
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(data.freeVsPaid.paidTokens)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.freeVsPaid.firstPaidAt
                    ? `Платный период начался: ${new Date(data.freeVsPaid.firstPaidAt).toLocaleDateString("ru-RU")}`
                    : "Оплат пока не было: используется только бесплатный пул"}
                </p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Расход по дням (текущий период)
                </p>
                {data.daily.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Пока нет списаний в этом периоде</p>
                ) : (
                  <div className="space-y-2">
                    {data.daily.map((row) => {
                      const max = Math.max(...data.daily.map((d) => d.totalTokens), 1);
                      const width = Math.max(3, Math.round((row.totalTokens / max) * 100));
                      return (
                        <div key={row.date} className="grid grid-cols-[86px_1fr_88px] items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{new Date(row.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</span>
                          <div className="h-6 rounded-md bg-surface2/60 p-1">
                            <div
                              className="h-full rounded bg-gradient-to-r from-primary/80 to-violet-400/80"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className="text-right font-medium">{formatNumber(row.totalTokens)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => {
                  const used = data.currentCycle.byCategory[key] ?? 0;
                  const quota = data.quotas[key];
                  const remaining = quota != null ? Math.max(0, quota - used) : null;
                  return (
                    <div key={key} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{CATEGORY_LABELS[key]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(used)} / {formatNumber(quota)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Осталось: {formatNumber(remaining)} · Запросов: {data.currentCycle.byCategoryCount[key] ?? 0}
                      </p>
                    </div>
                  );
                })}
                {data.imageGeneration != null && (
                  <div className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Генерация изображений</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(data.imageGeneration.used)} / {formatNumber(data.imageGeneration.quota)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Осталось:{" "}
                      {formatNumber(
                        data.imageGeneration.quota != null
                          ? Math.max(0, data.imageGeneration.quota - data.imageGeneration.used)
                          : null
                      )}{" "}
                      · Запросов: {data.imageGeneration.count}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/80">За отчётный период</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-surface2/20 p-4">
                <p className="text-sm font-medium">Суммарно от точки отсчета</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" />
                  Всего токенов: {formatNumber(data.sinceAnchor.totalTokens)}
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>{CATEGORY_LABELS[key]}</span>
                      <span>{formatNumber(data.sinceAnchor.byCategory[key] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Последние списания</p>
                {data.recentEvents.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Нет списаний в текущем периоде</p>
                ) : (
                  <div className="mt-2 space-y-1.5 text-xs">
                    {data.recentEvents.slice(0, 10).map((event) => (
                      <div key={event.id} className="flex items-center justify-between rounded-md bg-surface2/40 px-2 py-1.5">
                        <div>
                          <p>{event.title}</p>
                          <p className="text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatNumber(event.tokensTotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
