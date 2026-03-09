"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
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
    model: string | null;
    tokensTotal: number;
    createdAt: string;
  }>;
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
      ? "border-red-400/40 bg-red-500/10 text-red-300"
      : tone === "warn"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
        : tone === "ok"
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          : "border-border bg-surface2 text-foreground";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`hidden md:flex items-center gap-3 rounded-xl border px-3 py-2 text-xs transition-colors hover:bg-surface2 ${pillToneClass}`}
      >
        <Zap className="h-4 w-4" />
        <div className="text-left leading-tight">
          <div className="text-[10px] opacity-80">По тарифу</div>
          <div className="font-semibold">{loading ? "..." : formatNumber(data?.total.quota)}</div>
        </div>
        <div className="h-6 w-px bg-border/60" />
        <div className="text-left leading-tight">
          <div className="text-[10px] opacity-80">Осталось</div>
          <div className="font-semibold">{loading ? "..." : formatNumber(data?.total.remaining)}</div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
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
              </div>

              <div className="rounded-xl border border-border bg-surface2/20 p-4">
                <p className="text-sm font-medium">Суммарно от точки отсчета</p>
                <p className="mt-1 text-xs text-muted-foreground">
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
                          <p>{CATEGORY_LABELS[event.category]}</p>
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
