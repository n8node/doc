"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Video,
  ListOrdered,
  RefreshCw,
  Coins,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

interface VideoTaskConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface VideoModelConfig {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

const VIDEO_TASK_OPTIONS: { id: string; label: string }[] = [
  { id: "kling30_video", label: "Kling 3.0 — сюжет и кадры" },
  { id: "kling30_motion", label: "Kling 3.0 — перенос движения" },
];

const VIDEO_MODEL_OPTIONS: { id: string; name: string; description: string; taskIds: string[] }[] = [
  {
    id: "kie-kling-30-video",
    name: "Kling 3.0 Video",
    description: "Текст / кадры, звук, 3–15 с (std/pro)",
    taskIds: ["kling30_video"],
  },
  {
    id: "kie-kling-30-motion",
    name: "Kling 3.0 Motion Control",
    description: "Изображение + референс-видео (720p/1080p)",
    taskIds: ["kling30_motion"],
  },
];

export default function AdminGenerationVideoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [videoTasks, setVideoTasks] = useState<VideoTaskConfig[]>([]);
  const [videoModels, setVideoModels] = useState<VideoModelConfig[]>([]);
  const [pricingItems, setPricingItems] = useState<
    { id: string; modelId: string; variant: string | null; priceCredits: number; priceUsd: number | null; fetchedAt: string }[]
  >([]);
  const [pricingFetchedAt, setPricingFetchedAt] = useState<string | null>(null);
  const [pricingSyncing, setPricingSyncing] = useState(false);
  const [pricingEdits, setPricingEdits] = useState<Record<string, number>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [resettingTasksModels, setResettingTasksModels] = useState(false);
  const [statsItems, setStatsItems] = useState<
    {
      id: string;
      userEmail: string;
      userName: string | null;
      createdAt: string;
      modelId: string;
      variant: string | null;
      taskType: string;
      resultUrl: string | null;
      fileId: string | null;
      costCredits: number | null;
      billedCredits: number | null;
    }[]
  >([]);
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/generation/config");
      const config = await res.json();
      if (res.ok) {
        setVideoEnabled(config.videoEnabled === true);
        setVideoTasks(
          Array.isArray(config.videoTasks) && config.videoTasks.length > 0
            ? config.videoTasks
            : VIDEO_TASK_OPTIONS.map((t, i) => ({ ...t, enabled: true, order: i + 1 })),
        );
        setVideoModels(
          Array.isArray(config.videoModels) && config.videoModels.length > 0
            ? config.videoModels
            : VIDEO_MODEL_OPTIONS.map((m, i) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                displayName: m.name,
                enabled: true,
                taskIds: m.taskIds,
                order: i + 1,
              })),
        );
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
      const res = await fetch("/api/v1/admin/generation/stats?limit=100&media=video");
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

  const videoPricingRows = useMemo(
    () => pricingItems.filter((row) => row.modelId.startsWith("kie-kling")),
    [pricingItems],
  );

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

  const handleResetVideoTasksModels = async () => {
    setResettingTasksModels(true);
    try {
      const res = await fetch("/api/v1/admin/generation/config/reset-tasks-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "video" }),
      });
      if (!res.ok) {
        toast.error("Ошибка сброса");
        return;
      }
      await loadConfig();
      toast.success("Задачи и модели видео сброшены");
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setResettingTasksModels(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/generation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoEnabled,
          videoTasks,
          videoModels,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast.success("Настройки видео сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const toggleVideoTask = (id: string) => {
    setVideoTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const toggleVideoModel = (id: string) => {
    setVideoModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const toggleVideoModelTask = (modelId: string, taskId: string) => {
    setVideoModels((prev) =>
      prev.map((m) => {
        if (m.id !== modelId) return m;
        const has = m.taskIds.includes(taskId);
        return { ...m, taskIds: has ? m.taskIds.filter((t) => t !== taskId) : [...m.taskIds, taskId] };
      }),
    );
  };

  const setVideoModelDisplayName = (modelId: string, displayName: string) => {
    setVideoModels((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, displayName: displayName.trim() || undefined } : m)),
    );
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
        <Link
          href="/admin/generation"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Генерация изображений (ключ Kie, наценка, курс кредита)
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Генерация видео (Kling, Kie.ai)</h1>
        <p className="mt-1 text-muted-foreground">
          Включение раздела для пользователей, задачи и модели Kling, прайс по вариантам (длительность, качество). Общий API-ключ и наценка на кредиты — в разделе «Генерация изображений».
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5" />
            Раздел видео
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={videoEnabled}
              onChange={(e) => setVideoEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-medium">Генерация видео (Kling) включена для пользователей</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Доступ в кабинете также зависит от тарифа: фича «Генерация видео» и месячная квота кредитов в админке → Тарифы.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5" />
            Прайс видео Kling (кредиты по модели и варианту)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <code className="text-xs">kie-kling-30-video</code> — варианты std/pro, длительность, звук;{" "}
            <code className="text-xs">kie-kling-30-motion</code> — разрешение и режим. Полный список после «Обновить прайс» с{" "}
            <a href="https://kie.ai/pricing" target="_blank" rel="noopener noreferrer" className="underline">
              kie.ai/pricing
            </a>
            .
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricingFetchedAt && (
            <p className="text-xs text-muted-foreground">
              Последнее обновление: {new Date(pricingFetchedAt).toLocaleString()}
            </p>
          )}
          {videoPricingRows.length > 0 ? (
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
                  {videoPricingRows.map((row) => (
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
            <p className="text-sm text-muted-foreground">
              Строк Kling в прайсе пока нет. Нажмите «Обновить прайс» на этой странице или в разделе изображений (общая таблица Kie).
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleSyncPricing} disabled={pricingSyncing}>
              {pricingSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Обновить прайс
            </Button>
            {videoPricingRows.length > 0 && (
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
            Статистика генераций видео
          </CardTitle>
          <p className="text-sm text-muted-foreground">Последние 100 успешных генераций видео.</p>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка...
            </div>
          ) : statsItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных.</p>
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
                      <td className="p-2">
                        {row.modelId}
                        {row.variant ? ` / ${row.variant}` : ""}
                      </td>
                      <td className="p-2 text-muted-foreground">{row.taskType}</td>
                      <td className="p-2">
                        {row.resultUrl ? (
                          <a
                            href={row.resultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline truncate max-w-[120px] inline-block"
                          >
                            Ссылка
                          </a>
                        ) : row.fileId ? (
                          <span className="text-muted-foreground">Файл {row.fileId}</span>
                        ) : (
                          "—"
                        )}
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
            <p className="text-xs text-muted-foreground mt-2">Всего успешных генераций видео: {statsTotal}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrdered className="h-5 w-5" />
            Задачи и модели (видео)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Раздел «Генерация → Видео» в кабинете пользователя.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Задачи</h3>
            <ul className="space-y-2">
              {videoTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={() => toggleVideoTask(t.id)}
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
              {videoModels.map((m) => (
                <li key={m.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleVideoModel(m.id)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="font-medium">Системное: {m.name}</span>
                    {m.description && <span className="text-muted-foreground text-sm">— {m.description}</span>}
                  </div>
                  <div className="pl-6 space-y-1">
                    <label className="text-xs text-muted-foreground">Публичное название</label>
                    <Input
                      value={m.displayName ?? ""}
                      onChange={(e) => setVideoModelDisplayName(m.id, e.target.value)}
                      placeholder={m.name}
                      className="max-w-md"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    {VIDEO_TASK_OPTIONS.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={m.taskIds.includes(t.id)}
                          onChange={() => toggleVideoModelTask(m.id, t.id)}
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
            <Button variant="outline" onClick={handleResetVideoTasksModels} disabled={resettingTasksModels}>
              {resettingTasksModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Сброс задач и моделей
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
