"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Mic2, MessageCircle, Database, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UsageStats {
  periodDays: number;
  since: string;
  transcription: {
    totalTokens: number;
    byModel: Array<{ model: string; tokens: number; tasks: number }>;
    byUser: Array<{
      userId: string;
      email: string;
      name: string | null;
      tokens: number;
      tasks: number;
    }>;
  };
  chatDocument: {
    totalTokens: number;
    byModel: Array<{ model: string; tokens: number; tasks: number }>;
    byUser: Array<{
      userId: string;
      email: string;
      name: string | null;
      tokens: number;
      tasks: number;
    }>;
  };
  search: {
    totalTokens: number;
    byModel: Array<{ model: string; tokens: number; tasks: number }>;
    byUser: Array<{
      userId: string;
      email: string;
      name: string | null;
      tokens: number;
      tasks: number;
    }>;
  };
  embedding: {
    totalTokens: number;
    byModel: Array<{ model: string; tokens: number; tasks: number }>;
    byUser: Array<{
      userId: string;
      email: string;
      name: string | null;
      tokens: number;
      tasks: number;
    }>;
  };
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || typeof n !== "number") return "0";
  return n.toLocaleString("ru-RU");
}

function SectionCard({
  title,
  icon: Icon,
  total,
  unit,
  byModel,
  byUser,
}: {
  title: string;
  icon: React.ElementType;
  total: number;
  unit: string;
  byModel: Array<{ model: string; minutes?: number; tokens?: number; tasks: number }>;
  byUser: Array<{ userId: string; email: string; name: string | null; minutes?: number; tokens?: number; tasks: number }>;
}) {
  const [view, setView] = useState<"model" | "user">("model");
  const dataKey = "tokens";

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-surface2/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">{title}</h2>
          </div>
          <span className="text-lg font-bold text-foreground">
            {formatNumber(total)} {unit}
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setView("model")}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              view === "model" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            По моделям
          </button>
          <button
            type="button"
            onClick={() => setView("user")}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              view === "user" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            По пользователям
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {view === "model" ? (
          byModel.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Нет данных за период</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-4 py-2 text-left font-medium">Модель</th>
                  <th className="px-4 py-2 text-right font-medium">{unit}</th>
                  <th className="px-4 py-2 text-right font-medium">Задач</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={row.model} className="border-b border-border/50 hover:bg-surface2/20">
                    <td className="px-4 py-2">{row.model}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatNumber(row[dataKey] ?? 0)}</td>
                    <td className="px-4 py-2 text-right">{row.tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : byUser.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Нет данных за период</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2/30">
                <th className="px-4 py-2 text-left font-medium">Пользователь</th>
                <th className="px-4 py-2 text-right font-medium">{unit}</th>
                <th className="px-4 py-2 text-right font-medium">Запросов</th>
              </tr>
            </thead>
            <tbody>
              {byUser.map((row) => (
                <tr key={row.userId} className="border-b border-border/50 hover:bg-surface2/20">
                  <td className="px-4 py-2">
                    <span className="font-medium">{row.email}</span>
                    {row.name && <span className="ml-1 text-muted-foreground">({row.name})</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatNumber(row[dataKey] ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{row.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/ai/usage-stats?period=${period}`);
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        toast.error(data.error || "Ошибка загрузки");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Статистика AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Расход токенов по всем AI-операциям</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="grid gap-6">
          <SectionCard
            title="Транскрибация"
            icon={Mic2}
            total={stats.transcription.totalTokens}
            unit="токенов"
            byModel={stats.transcription.byModel}
            byUser={stats.transcription.byUser}
          />
          <SectionCard
            title="Чат по документу"
            icon={MessageCircle}
            total={stats.chatDocument.totalTokens}
            unit="токенов"
            byModel={stats.chatDocument.byModel}
            byUser={stats.chatDocument.byUser}
          />
          <SectionCard
            title="Поиск"
            icon={Search}
            total={stats.search.totalTokens}
            unit="токенов"
            byModel={stats.search.byModel}
            byUser={stats.search.byUser}
          />
          <SectionCard
            title="Эмбеддинг"
            icon={Database}
            total={stats.embedding.totalTokens}
            unit="токенов"
            byModel={stats.embedding.byModel}
            byUser={stats.embedding.byUser}
          />
        </div>
      ) : null}
    </div>
  );
}
