"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Wallet,
  RefreshCw,
  Loader2,
  Plus,
  Settings,
  TrendingUp,
  CreditCard,
  DollarSign,
  Trash2,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "summary" | "settings" | "batches" | "expenses" | "profitability";

interface FinanceSettings {
  taxRatePct: number;
  paymentCommissionPct: number;
  paymentCommissionPayer: "platform" | "user";
  fxBufferPct: number;
  s3CostPerGbDayCents: number;
  s3MarkupPct: number;
  defaultTokenMarkupPct: number;
}

interface Batch {
  id: string;
  usdAmount: number;
  rubSpentCents: number;
  rubFeeCents: number;
  effectiveRateRubPerUsd: number;
  usdRemaining: number;
  source: string | null;
  comment: string | null;
  toppedAt: string;
}

interface Expense {
  id: string;
  category: string;
  type: string;
  amountCents: number;
  unit: string | null;
  sinceAt: string;
  comment: string | null;
}

interface Summary {
  blendedRateRubPerUsd: number | null;
  workingRateRubPerUsd: number | null;
  totalUsdRemaining: number;
  batchesCount: number;
  monthlyFixedCents: number;
  monthlyVariableCents?: number;
  totalMonthlyExpensesCents?: number;
  totalStorageGb?: number;
  variableExpenseItems?: { category: string; amountCents: number; storageGb: number }[];
  refMonth?: string;
  settings: Partial<FinanceSettings>;
}

interface TariffProfitabilityItem {
  id: string;
  name: string;
  isFree: boolean;
  usersCount: number;
  priceMonthlyRub: number;
  allocatedFixedCents: number;
  allocatedFixedRub: string;
  profitCents: number;
  profitRub: string;
  status: "profitable" | "at_risk" | "loss" | "free";
  minPriceForTargetRub: number | null;
}

function formatRub(cents: number): string {
  return `${(cents / 100).toFixed(2)} ₽`;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function AdminFinancePage() {
  const [tab, setTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [formSettings, setFormSettings] = useState<Partial<FinanceSettings>>({});
  const [formBatch, setFormBatch] = useState({
    usdAmount: "",
    rubSpentCents: "",
    rubFeeCents: "0",
    toppedAt: new Date().toISOString().slice(0, 10),
    source: "",
    comment: "",
  });
  const [formExpense, setFormExpense] = useState({
    category: "server",
    type: "fixed_monthly",
    amountCents: "",
    unit: "",
    sinceAt: new Date().toISOString().slice(0, 10),
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [profitability, setProfitability] = useState<{
    items: TariffProfitabilityItem[];
    totalMonthlyFixedCents: number;
    totalPaidUsers: number;
    targetProfitRub: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, setRes, batchRes, expRes, profRes] = await Promise.all([
        fetch(`/api/v1/admin/finance/summary${summaryMonth ? `?month=${summaryMonth}` : ""}`),
        fetch("/api/v1/admin/finance/settings"),
        fetch("/api/v1/admin/finance/batches"),
        fetch("/api/v1/admin/finance/expenses"),
        fetch("/api/v1/admin/finance/tariff-profitability"),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (setRes.ok) {
        const s = await setRes.json();
        setSettings(s);
        setFormSettings(s);
      }
      if (batchRes.ok) {
        const d = await batchRes.json();
        setBatches(d.batches ?? []);
      }
      if (expRes.ok) {
        const d = await expRes.json();
        setExpenses(d.expenses ?? []);
      }
      if (profRes.ok) {
        setProfitability(await profRes.json());
      }
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [summaryMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/finance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formSettings),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast.success("Настройки сохранены");
      void load();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/finance/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usdAmount: parseFloat(formBatch.usdAmount) || 0,
          rubSpentCents: Math.round(parseFloat(formBatch.rubSpentCents) * 100) || 0,
          rubFeeCents: Math.round(parseFloat(formBatch.rubFeeCents) * 100) || 0,
          toppedAt: formBatch.toppedAt,
          source: formBatch.source || undefined,
          comment: formBatch.comment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка");
      }
      toast.success("Партия добавлена");
      setFormBatch({
        usdAmount: "",
        rubSpentCents: "",
        rubFeeCents: "0",
        toppedAt: new Date().toISOString().slice(0, 10),
        source: "",
        comment: "",
      });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formExpense.category,
          type: formExpense.type,
          amountCents: Math.round(parseFloat(formExpense.amountCents) * 100) || 0,
          unit: formExpense.unit || undefined,
          sinceAt: formExpense.sinceAt,
          comment: formExpense.comment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка");
      }
      toast.success("Расход добавлен");
      setFormExpense({
        category: "server",
        type: "fixed_monthly",
        amountCents: "",
        unit: "",
        sinceAt: new Date().toISOString().slice(0, 10),
        comment: "",
      });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!confirm("Удалить партию? Это действие нельзя отменить.")) return;
    setDeletingBatchId(id);
    try {
      const res = await fetch(`/api/v1/admin/finance/batches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      toast.success("Партия удалена");
      void load();
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setDeletingBatchId(null);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Удалить расход? Это действие нельзя отменить.")) return;
    setDeletingExpenseId(id);
    try {
      const res = await fetch(`/api/v1/admin/finance/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      toast.success("Расход удалён");
      void load();
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7" />
            Финансы платформы
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Налог, комиссии, партии OpenRouter, расходы, рентабельность
          </p>
        </div>
        <Button onClick={() => void load()} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Обновить
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(["summary", "profitability", "settings", "batches", "expenses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            {t === "summary" && "Сводка"}
            {t === "profitability" && "Рентабельность"}
            {t === "settings" && "Настройки"}
            {t === "batches" && "Партии OpenRouter"}
            {t === "expenses" && "Расходы"}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Месяц:</label>
            <Input
              type="month"
              value={summaryMonth}
              onChange={(e) => setSummaryMonth(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Средневзвешенный курс
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {summary?.blendedRateRubPerUsd != null
                    ? `${summary.blendedRateRubPerUsd.toFixed(2)} ₽/USD`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Добавьте партии пополнения OpenRouter
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Рабочий курс
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {summary?.workingRateRubPerUsd != null
                    ? `${summary.workingRateRubPerUsd.toFixed(2)} ₽/USD`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  С учётом буфера {summary?.settings?.fxBufferPct ?? 5}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">USD в партиях</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatUsd(summary?.totalUsdRemaining ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.batchesCount ?? 0} активных партий
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Фикс. расходы / мес
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatRub(summary?.monthlyFixedCents ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  sinceAt ≤ конец месяца
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Перем. расходы (S3)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatRub(summary?.monthlyVariableCents ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.totalStorageGb?.toFixed(1) ?? "0"} ГБ × 30 дней
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Всего расходы / мес</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatRub(summary?.totalMonthlyExpensesCents ?? (summary?.monthlyFixedCents ?? 0))}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "profitability" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Рентабельность тарифов
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Фикс. расходы распределены по платным пользователям. Цель: ≥{profitability?.targetProfitRub ?? 1000} ₽ прибыли с тарифа.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface2/50">
                    <th className="px-4 py-2 text-left">Тариф</th>
                    <th className="px-4 py-2 text-right">Пользователей</th>
                    <th className="px-4 py-2 text-right">Цена ₽</th>
                    <th className="px-4 py-2 text-right">Доля расходов ₽</th>
                    <th className="px-4 py-2 text-right">Прибыль ₽</th>
                    <th className="px-4 py-2 text-right">Мин. цена для 1000 ₽</th>
                    <th className="px-4 py-2 text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {profitability?.items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">
                        {item.name}
                        {item.isFree && (
                          <span className="ml-1 text-xs text-muted-foreground">(бесплатный)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{item.usersCount}</td>
                      <td className="px-4 py-2 text-right">{item.isFree ? "—" : `${item.priceMonthlyRub} ₽`}</td>
                      <td className="px-4 py-2 text-right">{item.allocatedFixedRub} ₽</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {item.isFree ? "—" : `${item.profitRub} ₽`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {item.minPriceForTargetRub != null ? `${item.minPriceForTargetRub} ₽` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {item.status === "profitable" && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600">
                            <CheckCircle className="h-3 w-3" />
                            Прибыльный
                          </span>
                        )}
                        {item.status === "at_risk" && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            На грани
                          </span>
                        )}
                        {item.status === "loss" && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-600">
                            <XCircle className="h-3 w-3" />
                            Убыточный
                          </span>
                        )}
                        {item.status === "free" && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!profitability?.items?.length) && (
                <p className="p-6 text-center text-muted-foreground">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Налог и комиссии
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1">Налог ИП (%)</label>
              <Input
                type="number"
                step="0.1"
                value={formSettings.taxRatePct ?? settings?.taxRatePct ?? 7}
                onChange={(e) => setFormSettings((s) => ({ ...s, taxRatePct: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Комиссия эквайринга (%)</label>
              <Input
                type="number"
                step="0.1"
                value={formSettings.paymentCommissionPct ?? settings?.paymentCommissionPct ?? 2.5}
                onChange={(e) =>
                  setFormSettings((s) => ({ ...s, paymentCommissionPct: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Кто платит комиссию</label>
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={formSettings.paymentCommissionPayer ?? settings?.paymentCommissionPayer ?? "platform"}
                onChange={(e) =>
                  setFormSettings((s) => ({
                    ...s,
                    paymentCommissionPayer: e.target.value as "platform" | "user",
                  }))
                }
              >
                <option value="platform">Платформа (вы получаете меньше)</option>
                <option value="user">Пользователь (добавляется к цене)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Валютный буфер (%)</label>
              <Input
                type="number"
                step="0.5"
                value={formSettings.fxBufferPct ?? settings?.fxBufferPct ?? 5}
                onChange={(e) => setFormSettings((s) => ({ ...s, fxBufferPct: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">S3 себестоимость (коп/ГБ/день)</label>
              <Input
                type="number"
                step="0.01"
                value={formSettings.s3CostPerGbDayCents ?? settings?.s3CostPerGbDayCents ?? 7}
                onChange={(e) =>
                  setFormSettings((s) => ({ ...s, s3CostPerGbDayCents: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Наценка на токены (%)</label>
              <Input
                type="number"
                step="1"
                value={formSettings.defaultTokenMarkupPct ?? settings?.defaultTokenMarkupPct ?? 30}
                onChange={(e) =>
                  setFormSettings((s) => ({ ...s, defaultTokenMarkupPct: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "batches" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Добавить партию пополнения OpenRouter
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Укажите USD получено, RUB потрачено, комиссию. Курс рассчитается автоматически.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBatch} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">USD получено</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={formBatch.usdAmount}
                    onChange={(e) => setFormBatch((f) => ({ ...f, usdAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RUB потрачено (в рублях)</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    placeholder="10000"
                    value={formBatch.rubSpentCents}
                    onChange={(e) => setFormBatch((f) => ({ ...f, rubSpentCents: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Комиссия (RUB)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formBatch.rubFeeCents}
                    onChange={(e) => setFormBatch((f) => ({ ...f, rubFeeCents: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата пополнения</label>
                  <Input
                    type="date"
                    value={formBatch.toppedAt}
                    onChange={(e) => setFormBatch((f) => ({ ...f, toppedAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Источник</label>
                  <Input
                    placeholder="карта, крипта, обменник"
                    value={formBatch.source}
                    onChange={(e) => setFormBatch((f) => ({ ...f, source: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Input
                    value={formBatch.comment}
                    onChange={(e) => setFormBatch((f) => ({ ...f, comment: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Добавить партию
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Партии</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface2/50">
                      <th className="px-4 py-2 text-left">Дата</th>
                      <th className="px-4 py-2 text-right">USD</th>
                      <th className="px-4 py-2 text-right">RUB</th>
                      <th className="px-4 py-2 text-right">Курс ₽/USD</th>
                      <th className="px-4 py-2 text-right">Остаток USD</th>
                      <th className="px-4 py-2 text-left">Источник</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-4 py-2">{new Date(b.toppedAt).toLocaleDateString("ru-RU")}</td>
                        <td className="px-4 py-2 text-right">{formatUsd(b.usdAmount)}</td>
                        <td className="px-4 py-2 text-right">{formatRub(b.rubSpentCents + b.rubFeeCents)}</td>
                        <td className="px-4 py-2 text-right font-mono">{b.effectiveRateRubPerUsd.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{formatUsd(b.usdRemaining)}</td>
                        <td className="px-4 py-2">{b.source || "—"}</td>
                        <td className="px-4 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={() => handleDeleteBatch(b.id)}
                            disabled={deletingBatchId === b.id}
                            aria-label="Удалить"
                          >
                            {deletingBatchId === b.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {batches.length === 0 && <p className="p-6 text-center text-muted-foreground">Нет партий</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Добавить расход
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Сервер, S3, домен и т.д. type: fixed_monthly — фикс. сумма, variable_per_gb_day — за ГБ/день.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpense} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Категория</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={formExpense.category}
                    onChange={(e) => setFormExpense((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option value="server">Сервер</option>
                    <option value="s3">S3 хранилище</option>
                    <option value="domain">Домен</option>
                    <option value="other">Прочее</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Тип</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={formExpense.type}
                    onChange={(e) => setFormExpense((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="fixed_monthly">Фикс. в месяц (₽)</option>
                    <option value="variable_per_gb_day">Переменный (₽/ГБ/день)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {formExpense.type === "variable_per_gb_day"
                      ? "Стоимость за 1 ГБ/день (₽)"
                      : "Сумма (₽)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    placeholder={formExpense.type === "variable_per_gb_day" ? "0.07" : "8000"}
                    value={formExpense.amountCents}
                    onChange={(e) => setFormExpense((f) => ({ ...f, amountCents: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата начала</label>
                  <Input
                    type="date"
                    value={formExpense.sinceAt}
                    onChange={(e) => setFormExpense((f) => ({ ...f, sinceAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Input
                    value={formExpense.comment}
                    onChange={(e) => setFormExpense((f) => ({ ...f, comment: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Добавить расход
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Расходы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface2/50">
                      <th className="px-4 py-2 text-left">Категория</th>
                      <th className="px-4 py-2 text-left">Тип</th>
                      <th className="px-4 py-2 text-right">Сумма</th>
                      <th className="px-4 py-2 text-left">С</th>
                      <th className="px-4 py-2 text-left">Комментарий</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-4 py-2">{e.category}</td>
                        <td className="px-4 py-2">{e.type}</td>
                        <td className="px-4 py-2 text-right">{formatRub(e.amountCents)}</td>
                        <td className="px-4 py-2">{new Date(e.sinceAt).toLocaleDateString("ru-RU")}</td>
                        <td className="px-4 py-2">{e.comment || "—"}</td>
                        <td className="px-4 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={() => handleDeleteExpense(e.id)}
                            disabled={deletingExpenseId === e.id}
                            aria-label="Удалить"
                          >
                            {deletingExpenseId === e.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {expenses.length === 0 && <p className="p-6 text-center text-muted-foreground">Нет расходов</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
