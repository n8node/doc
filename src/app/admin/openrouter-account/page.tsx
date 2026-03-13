"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  Wallet,
  Key,
  BarChart3,
  ExternalLink,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreditsData {
  data?: {
    total_credits: number;
    total_usage: number;
  };
}

interface KeyItem {
  hash: string;
  name: string;
  label: string;
  disabled: boolean;
  limit: number | null;
  limit_remaining: number | null;
  limit_reset: string | null;
  usage: number;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  byok_usage: number;
  byok_usage_daily: number;
  byok_usage_weekly: number;
  byok_usage_monthly: number;
  created_at: string;
  updated_at: string | null;
  expires_at?: string | null;
}

interface KeysData {
  data?: KeyItem[];
}

interface ActivityItem {
  date: string;
  model: string;
  model_permaslug: string;
  endpoint_id: string;
  provider_name: string;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
}

interface ActivityData {
  data?: ActivityItem[];
}

interface CurrentKeyData {
  data?: KeyItem & {
    is_free_tier: boolean;
    is_management_key: boolean;
    is_provisioning_key: boolean;
  };
}

interface ApiResponse {
  credits: CreditsData | null;
  keys: KeysData | null;
  activity: ActivityData | null;
  currentKey: CurrentKeyData | null;
  errors: {
    credits: string | null;
    keys: string | null;
    activity: string | null;
    currentKey: string | null;
  };
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || typeof n !== "number") return "—";
  return `$${n.toFixed(4)}`;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OpenRouterAccountPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "keys" | "activity">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = dateFilter
        ? `/api/v1/admin/openrouter-account?date=${encodeURIComponent(dateFilter)}`
        : "/api/v1/admin/openrouter-account";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? json.error ?? "Ошибка загрузки");
        if (json.error === "KEY_NOT_SET") {
          toast.error("Настройте Management API ключ в Настройки → Маркетплейс");
        }
        setData(null);
        return;
      }
      setData(json as ApiResponse);
    } catch {
      setError("Ошибка соединения");
      setData(null);
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const credits = data?.credits?.data;
  const keys = data?.keys?.data ?? [];
  const activity = data?.activity?.data ?? [];
  const currentKey = data?.currentKey?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">OpenRouter — данные аккаунта</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Все доступные данные через Management API (credits, keys, activity)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            placeholder="Фильтр по дате"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => void load()} disabled={loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Обновить
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">{error}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Management API ключ настраивается в{" "}
                <a href="/admin/settings?tab=marketplace" className="text-primary hover:underline">
                  Настройки → Маркетплейс
                </a>
                . Создать ключ:{" "}
                <a
                  href="https://openrouter.ai/settings/management-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  openrouter.ai/settings/management-keys <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!error && data && (
        <>
          <div className="flex gap-2 border-b border-border pb-2">
            {(["overview", "keys", "activity"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface2"
                }`}
              >
                {tab === "overview" && "Обзор"}
                {tab === "keys" && `API Keys (${keys.length})`}
                {tab === "activity" && `Активность (${activity.length})`}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Кредиты
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {credits ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        Куплено: <strong>{formatUsd(credits.total_credits)}</strong>
                      </p>
                      <p>
                        Использовано: <strong>{formatUsd(credits.total_usage)}</strong>
                      </p>
                      <p>
                        Остаток:{" "}
                        <strong className="text-emerald-600">
                          {formatUsd((credits.total_credits ?? 0) - (credits.total_usage ?? 0))}
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">—</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Текущий ключ (Management)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentKey ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        Label: <strong>{currentKey.label}</strong>
                      </p>
                      <p>
                        Usage: {formatUsd(currentKey.usage)} (день: {formatUsd(currentKey.usage_daily)}, месяц:{" "}
                        {formatUsd(currentKey.usage_monthly)})
                      </p>
                      <p>
                        Limit: {currentKey.limit != null ? formatUsd(currentKey.limit) : "∞"}
                        {currentKey.limit_remaining != null && (
                          <> · Остаток: {formatUsd(currentKey.limit_remaining)}</>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {currentKey.is_management_key ? "Management key" : ""} ·{" "}
                        {currentKey.is_free_tier ? "Free tier" : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">—</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Всего ключей
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{keys.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Суммарный usage по всем ключам:{" "}
                    {formatUsd(keys.reduce((s, k) => s + (k.usage ?? 0), 0))}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "keys" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface2/50">
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Label</th>
                        <th className="px-4 py-2 text-right">Usage</th>
                        <th className="px-4 py-2 text-right">Limit</th>
                        <th className="px-4 py-2 text-right">Daily</th>
                        <th className="px-4 py-2 text-right">Monthly</th>
                        <th className="px-4 py-2 text-left">Created</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k.hash} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{k.name || "—"}</td>
                          <td className="px-4 py-2 font-mono text-xs">{k.label}</td>
                          <td className="px-4 py-2 text-right">{formatUsd(k.usage)}</td>
                          <td className="px-4 py-2 text-right">{k.limit != null ? formatUsd(k.limit) : "∞"}</td>
                          <td className="px-4 py-2 text-right">{formatUsd(k.usage_daily)}</td>
                          <td className="px-4 py-2 text-right">{formatUsd(k.usage_monthly)}</td>
                          <td className="px-4 py-2 text-muted-foreground">{formatDate(k.created_at)}</td>
                          <td className="px-4 py-2">
                            {k.disabled ? (
                              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-600">
                                Disabled
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600">
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {keys.length === 0 && (
                    <p className="p-6 text-center text-muted-foreground">Нет ключей</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "activity" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Активность по эндпоинтам (последние 30 дней UTC)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Usage в USD, токены, запросы. Фильтр по дате — сверху.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface2/50">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Model</th>
                        <th className="px-4 py-2 text-left">Provider</th>
                        <th className="px-4 py-2 text-right">Usage $</th>
                        <th className="px-4 py-2 text-right">Requests</th>
                        <th className="px-4 py-2 text-right">Prompt</th>
                        <th className="px-4 py-2 text-right">Completion</th>
                        <th className="px-4 py-2 text-right">Reasoning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.slice(0, 100).map((a, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-2">{a.date}</td>
                          <td className="px-4 py-2 font-mono text-xs">{a.model}</td>
                          <td className="px-4 py-2">{a.provider_name}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatUsd(a.usage)}</td>
                          <td className="px-4 py-2 text-right">{a.requests?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2 text-right">{a.prompt_tokens?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2 text-right">{a.completion_tokens?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2 text-right">{a.reasoning_tokens?.toLocaleString() ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activity.length === 0 && (
                    <p className="p-6 text-center text-muted-foreground">Нет записей активности</p>
                  )}
                  {activity.length > 100 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      Показано 100 из {activity.length} записей
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
