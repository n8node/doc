"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, Wifi, CheckCircle, ImageIcon, Percent, ListOrdered, RefreshCw, Coins, BarChart3 } from "lucide-react";

interface ImageTaskConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface ImageModelConfig {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

const TASK_OPTIONS: { id: string; label: string }[] = [
  { id: "text_to_image", label: "Text to image" },
  { id: "edit_image", label: "Edit image" },
  { id: "variations", label: "Image to image" },
];

const MODEL_OPTIONS: { id: string; name: string; description: string }[] = [
  { id: "kie-4o-image", name: "4o Image", description: "Фотореализм, работа с текстом" },
  { id: "kie-flux-kontext", name: "Flux Kontext", description: "Стилизованные сцены" },
  { id: "kie-nano-banana-pro", name: "Nano Banana Pro", description: "Google Pro Image to Image" },
  { id: "kie-nano-banana-2", name: "Nano Banana 2", description: "Google, текст или изображения" },
  { id: "kie-nano-banana", name: "Nano Banana", description: "Google текст → изображение" },
  { id: "kie-nano-banana-edit", name: "Nano Banana Edit", description: "Google редактирование" },
  { id: "kie-qwen-text-to-image", name: "Qwen Text to Image", description: "Qwen текст → изображение" },
  { id: "kie-qwen-image-to-image", name: "Qwen Image to Image", description: "Qwen изображение → изображение" },
  { id: "kie-gpt-image-15-text", name: "GPT Image 1.5 Text", description: "GPT Image 1.5 текст → изображение" },
  { id: "kie-gpt-image-15-image", name: "GPT Image 1.5 Image", description: "GPT Image 1.5 редактирование" },
  { id: "kie-flux2-pro-text", name: "Flux-2 Pro Text", description: "Flux-2 Pro текст → изображение" },
  { id: "kie-flux2-pro-image", name: "Flux-2 Pro Image", description: "Flux-2 Pro изображение → изображение" },
  { id: "kie-flux2-flex-text", name: "Flux-2 Flex Text", description: "Flux-2 Flex текст → изображение" },
  { id: "kie-flux2-flex-image", name: "Flux-2 Flex Image", description: "Flux-2 Flex изображение → изображение" },
];

export default function AdminGenerationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [imageEnabled, setImageEnabled] = useState(true);
  const [marginPercent, setMarginPercent] = useState(0);
  const [kopecksPerCredit, setKopecksPerCredit] = useState(10);
  const [tasks, setTasks] = useState<ImageTaskConfig[]>([]);
  const [models, setModels] = useState<ImageModelConfig[]>([]);
  const [pricingItems, setPricingItems] = useState<{ id: string; modelId: string; variant: string | null; priceCredits: number; priceUsd: number | null; fetchedAt: string }[]>([]);
  const [pricingFetchedAt, setPricingFetchedAt] = useState<string | null>(null);
  const [pricingSyncing, setPricingSyncing] = useState(false);
  const [pricingEdits, setPricingEdits] = useState<Record<string, number>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [resettingTasksModels, setResettingTasksModels] = useState(false);
  const [statsItems, setStatsItems] = useState<{ id: string; userEmail: string; userName: string | null; createdAt: string; modelId: string; variant: string | null; taskType: string; resultUrl: string | null; fileId: string | null; costCredits: number | null; billedCredits: number | null }[]>([]);
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const [configRes, keyRes] = await Promise.all([
        fetch("/api/v1/admin/generation/config"),
        fetch("/api/v1/admin/kie/api-key"),
      ]);
      const config = await configRes.json();
      const keyData = await keyRes.json();
      if (configRes.ok) {
        setImageEnabled(config.imageEnabled ?? true);
        setMarginPercent(config.marginPercent ?? 0);
        setKopecksPerCredit(typeof config.kopecksPerCredit === "number" ? config.kopecksPerCredit : 10);
        setTasks(Array.isArray(config.imageTasks) && config.imageTasks.length > 0 ? config.imageTasks : TASK_OPTIONS.map((t, i) => ({ ...t, enabled: true, order: i + 1 })));
        setModels(Array.isArray(config.imageModels) && config.imageModels.length > 0 ? config.imageModels : MODEL_OPTIONS.map((m, i) => ({ ...m, displayName: m.name, enabled: true, taskIds: m.id === "kie-4o-image" ? ["text_to_image", "edit_image", "variations"] : ["text_to_image", "edit_image"], order: i + 1 })));
      }
      if (keyRes.ok && keyData.apiKeySet) {
        setApiKeySet(true);
        setApiKey("••••••••");
      }
    } catch {
      toast.error("Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/generation/pricing");
      const data = await res.json();
      if (res.ok && data.items) {
        setPricingItems(data.items);
        setPricingFetchedAt(data.fetchedAt ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/generation/stats?limit=100");
      const data = await res.json();
      if (res.ok) {
        setStatsItems(data.items ?? []);
        setStatsTotal(data.total ?? 0);
      }
    } catch {
      setStatsItems([]);
      setStatsTotal(0);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSyncPricing = async () => {
    setPricingSyncing(true);
    try {
      const res = await fetch("/api/v1/admin/generation/pricing/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await loadPricing();
        setPricingEdits({});
        toast.success(data.usedDefaults ? "Прайс обновлён (использованы значения по умолчанию)" : "Прайс синхронизирован");
      } else {
        toast.error("Ошибка синхронизации прайса");
      }
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setPricingSyncing(false);
    }
  };

  const setPricingCredit = (id: string, value: number) => {
    setPricingEdits((prev) => ({ ...prev, [id]: value }));
  };

  const handleSavePricingEdits = async () => {
    const ids = Object.keys(pricingEdits);
    if (ids.length === 0) {
      toast.info("Нет изменений для сохранения");
      return;
    }
    setPricingSaving(true);
    try {
      for (const id of ids) {
        const res = await fetch("/api/v1/admin/generation/pricing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, priceCredits: pricingEdits[id] }),
        });
        if (!res.ok) throw new Error("PATCH failed");
      }
      await loadPricing();
      setPricingEdits({});
      toast.success("Стоимость сохранена");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setPricingSaving(false);
    }
  };

  const handleResetTasksModels = async () => {
    setResettingTasksModels(true);
    try {
      const res = await fetch("/api/v1/admin/generation/config/reset-tasks-models", { method: "POST" });
      if (!res.ok) {
        toast.error("Ошибка сброса");
        return;
      }
      await loadConfig();
      toast.success("Задачи и модели сброшены к умолчанию");
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setResettingTasksModels(false);
    }
  };

  const handleTestKie = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/admin/kie/status");
      const data = await res.json();
      setTestResult({ ok: data.ok ?? false, message: data.message ?? (data.ok ? "Подключение успешно" : "Ошибка") });
      if (data.ok) toast.success("Подключение успешно");
      else toast.error(data.message);
    } catch {
      setTestResult({ ok: false, message: "Ошибка запроса" });
      toast.error("Ошибка запроса");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (apiKey === "••••••••" || !apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/kie/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setApiKey("••••••••");
      setApiKeySet(true);
      toast.success("Ключ сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/generation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageEnabled,
          marginPercent: Math.max(0, Math.min(95, Math.round(marginPercent))),
          kopecksPerCredit: Math.max(0, Math.round(kopecksPerCredit)),
          imageTasks: tasks,
          imageModels: models,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const toggleModel = (id: string) => {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const toggleModelTask = (modelId: string, taskId: string) => {
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== modelId) return m;
        const has = m.taskIds.includes(taskId);
        return { ...m, taskIds: has ? m.taskIds.filter((t) => t !== taskId) : [...m.taskIds, taskId] };
      })
    );
  };

  const setModelDisplayName = (modelId: string, displayName: string) => {
    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, displayName: displayName.trim() || undefined } : m)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Генерация изображений (Kie.ai)</h1>
        <p className="mt-1 text-muted-foreground">
          API-ключ Kie.ai, наценка на кредиты и список задач/моделей для раздела «Генерация» у пользователей.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            API-ключ Kie.ai
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Ключ</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? "••••••••" : "Введите API-ключ"}
              className="mt-1 max-w-md"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Получить ключ: <a href="https://kie.ai/api-key" target="_blank" rel="noopener noreferrer" className="underline">kie.ai/api-key</a>. Хранится в зашифрованном виде.
            </p>
          </div>
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                testResult.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"
              }`}
            >
              {testResult.ok ? <CheckCircle className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
              {testResult.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSaveKey} disabled={saving || !apiKey.trim() || apiKey === "••••••••"}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить ключ
            </Button>
            <Button variant="outline" onClick={handleTestKie} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Проверить соединение
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" />
            Раздел и наценка
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={imageEnabled}
              onChange={(e) => setImageEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-medium">Генерация изображений включена для пользователей</span>
          </label>
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-muted-foreground" />
            <div>
              <label className="block text-sm font-medium">Наценка на кредиты (%)</label>
              <Input
                type="number"
                min={0}
                max={95}
                value={marginPercent}
                onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
                className="mt-1 w-24"
              />
              <p className="mt-1 text-xs text-muted-foreground">0–95%. Отдельно от маркетплейса LLM.</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Курс: копеек за 1 кредит генерации (докупка с кошелька)</label>
              <Input
                type="number"
                min={0}
                value={kopecksPerCredit}
                onChange={(e) => setKopecksPerCredit(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-32"
              />
              <p className="mt-1 text-xs text-muted-foreground">При исчерпании квоты по тарифу списание с кошелька: кредиты × это значение = копейки.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5" />
            Прайс Kie (стоимость в кредитах по моделям)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Список дополняется актуальными моделями и вариантами (Flux Kontext: Pro/Max). Синхронизация с <a href="https://kie.ai/pricing" target="_blank" rel="noopener noreferrer" className="underline">kie.ai/pricing</a> — кнопка «Обновить прайс». Проставьте кредиты для недостающих строк и нажмите «Сохранить вручную».
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricingFetchedAt && (
            <p className="text-xs text-muted-foreground">
              Последнее обновление: {new Date(pricingFetchedAt).toLocaleString()}
            </p>
          )}
          {pricingItems.length > 0 ? (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium">Модель</th>
                    <th className="p-2 text-left font-medium">Вариант</th>
                    <th className="p-2 text-right font-medium">Кредиты</th>
                    <th className="p-2 text-right font-medium">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingItems.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2">{row.modelId}</td>
                      <td className="p-2 text-muted-foreground">{row.variant ?? "—"}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 text-right"
                          value={pricingEdits[row.id] ?? row.priceCredits}
                          onChange={(e) => setPricingCredit(row.id, parseInt(e.target.value, 10) || 0)}
                        />
                      </td>
                      <td className="p-2 text-right">{row.priceUsd != null ? row.priceUsd.toFixed(4) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Прайс пуст. Нажмите «Обновить прайс», чтобы загрузить цены (или подставить значения по умолчанию).</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleSyncPricing} disabled={pricingSyncing}>
              {pricingSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Обновить прайс
            </Button>
            {pricingItems.length > 0 && (
              <Button variant="secondary" onClick={handleSavePricingEdits} disabled={pricingSaving || Object.keys(pricingEdits).length === 0}>
                {pricingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Сохранить вручную
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Статистика генераций
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Кто, когда, какая модель, результат и стоимость (факт и с наценкой). Показаны последние 100 успешных генераций.
          </p>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка...
            </div>
          ) : statsItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных о генерациях.</p>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium">Пользователь</th>
                    <th className="p-2 text-left font-medium">Когда</th>
                    <th className="p-2 text-left font-medium">Модель</th>
                    <th className="p-2 text-left font-medium">Задача</th>
                    <th className="p-2 text-left font-medium">Результат</th>
                    <th className="p-2 text-right font-medium">Стоимость (факт)</th>
                    <th className="p-2 text-right font-medium">С наценкой</th>
                  </tr>
                </thead>
                <tbody>
                  {statsItems.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2">
                        <span className="font-medium">{row.userEmail}</span>
                        {row.userName && <span className="text-muted-foreground ml-1">({row.userName})</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="p-2">{row.modelId}{row.variant ? ` / ${row.variant}` : ""}</td>
                      <td className="p-2 text-muted-foreground">{row.taskType}</td>
                      <td className="p-2">
                        {row.resultUrl ? (
                          <a href={row.resultUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[120px] inline-block">Ссылка</a>
                        ) : row.fileId ? (
                          <span className="text-muted-foreground">Файл {row.fileId}</span>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-right">{row.costCredits ?? "—"}</td>
                      <td className="p-2 text-right">{row.billedCredits ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {statsTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Всего успешных генераций: {statsTotal}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrdered className="h-5 w-5" />
            Задачи и модели
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Какие задачи и модели показывать в разделе «Генерация» у пользователей.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Задачи</h3>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={() => toggleTask(t.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">{t.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Модели</h3>
            <ul className="space-y-3">
              {models.map((m) => (
                <li key={m.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleModel(m.id)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="font-medium">Системное: {m.name}</span>
                    {m.description && <span className="text-muted-foreground text-sm">— {m.description}</span>}
                  </div>
                  <div className="pl-6 space-y-1">
                    <label className="text-xs text-muted-foreground">Публичное название (для интерфейса)</label>
                    <Input
                      value={m.displayName ?? ""}
                      onChange={(e) => setModelDisplayName(m.id, e.target.value)}
                      placeholder={m.name}
                      className="max-w-md"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    {TASK_OPTIONS.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={m.taskIds.includes(t.id)}
                          onChange={() => toggleModelTask(m.id, t.id)}
                          className="h-3.5 w-3.5 rounded"
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить настройки
            </Button>
            <Button variant="outline" onClick={handleResetTasksModels} disabled={resettingTasksModels}>
              {resettingTasksModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Сбросить к умолчанию
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
