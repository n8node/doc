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
import type { VideoPricingFormulaConfig } from "@/lib/generation/config";
import {
  computeVideoPriceCredits,
  DEFAULT_VIDEO_PRICING_FORMULA,
} from "@/lib/generation/video-pricing-formula";

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

const PREVIEW_VARIANTS: { modelId: string; variant: string; label: string }[] = [
  { modelId: "kie-kling-30-video", variant: "std|d5|snd0", label: "Kling Video, std, 5 с, без звука" },
  { modelId: "kie-kling-30-video", variant: "std|d5|snd1", label: "Kling Video, std, 5 с, со звуком" },
  { modelId: "kie-kling-30-video", variant: "pro|d10|snd0", label: "Kling Video, pro, 10 с" },
  { modelId: "kie-kling-30-video", variant: "pro|d15|snd1", label: "Kling Video, pro, 15 с, звук" },
  { modelId: "kie-kling-30-motion", variant: "720p|image", label: "Motion 720p" },
  { modelId: "kie-kling-30-motion", variant: "1080p|video", label: "Motion 1080p" },
];

export default function AdminGenerationVideoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [videoTasks, setVideoTasks] = useState<VideoTaskConfig[]>([]);
  const [videoModels, setVideoModels] = useState<VideoModelConfig[]>([]);
  const [videoFormula, setVideoFormula] = useState<VideoPricingFormulaConfig>(DEFAULT_VIDEO_PRICING_FORMULA);
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
        if (config.videoPricingFormula && typeof config.videoPricingFormula === "object") {
          setVideoFormula({
            ...DEFAULT_VIDEO_PRICING_FORMULA,
            ...config.videoPricingFormula,
            kling30Video: {
              ...DEFAULT_VIDEO_PRICING_FORMULA.kling30Video,
              ...(config.videoPricingFormula.kling30Video ?? {}),
            },
            kling30Motion: {
              ...DEFAULT_VIDEO_PRICING_FORMULA.kling30Motion,
              ...(config.videoPricingFormula.kling30Motion ?? {}),
            },
            modelExtraCredits: {
              ...DEFAULT_VIDEO_PRICING_FORMULA.modelExtraCredits,
              ...(config.videoPricingFormula.modelExtraCredits ?? {}),
            },
          });
        }
      }
    } catch {
      toast.error("Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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

  const previewRows = useMemo(
    () =>
      PREVIEW_VARIANTS.map((row) => ({
        ...row,
        credits: computeVideoPriceCredits(row.modelId, row.variant, videoFormula),
      })),
    [videoFormula],
  );

  const handleSaveVideoFormula = async () => {
    setFormulaSaving(true);
    try {
      const res = await fetch("/api/v1/admin/generation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPricingFormula: videoFormula }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast.success("Формула цен сохранена");
      await loadConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setFormulaSaving(false);
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

  const setModelExtra = (modelId: string, value: number) => {
    setVideoFormula((f) => ({
      ...f,
      modelExtraCredits: { ...f.modelExtraCredits, [modelId]: Math.max(0, value) },
    }));
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
          Цены на видео считаются по формуле ниже (не из таблицы прайса). Общий API-ключ, процентная наценка на кредиты и курс кошелька — в разделе «Генерация изображений».
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
            Формула цен (кредиты)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <strong>Kling 3.0 Video:</strong> кредиты = база (std или pro) + длительность в секундах × коэффициент + (звук ? надбавка : 0) +{" "}
            <strong>доп. наценка на модель</strong>. Минимум 1 кредит.{" "}
            <strong>Motion:</strong> фикс за 720p или 1080p + доп. наценка на модель.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Kling 3.0 Video (сюжет / кадры)</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">База std</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Video.stdBase}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Video: { ...f.kling30Video, stdBase: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">База pro</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Video.proBase}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Video: { ...f.kling30Video, proBase: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Кредитов за 1 с (std)</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Video.stdPerSec}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Video: { ...f.kling30Video, stdPerSec: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Кредитов за 1 с (pro)</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Video.proPerSec}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Video: { ...f.kling30Video, proPerSec: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Надбавка при звуке (snd1)</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Video.soundExtra}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Video: { ...f.kling30Video, soundExtra: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Kling 3.0 Motion Control</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Кредиты 720p</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Motion.credits720p}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Motion: { ...f.kling30Motion, credits720p: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Кредиты 1080p</label>
                <Input
                  type="number"
                  min={0}
                  value={videoFormula.kling30Motion.credits1080p}
                  onChange={(e) =>
                    setVideoFormula((f) => ({
                      ...f,
                      kling30Motion: { ...f.kling30Motion, credits1080p: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Дополнительная наценка на модель (кредиты)</h4>
            <p className="text-xs text-muted-foreground">
              Прибавляется к результату формулы для каждой генерации этой модели (сверх базы, секунд и звука).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {VIDEO_MODEL_OPTIONS.map((m) => (
                <div key={m.id}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{m.name}</label>
                  <Input
                    type="number"
                    min={0}
                    value={videoFormula.modelExtraCredits[m.id] ?? 0}
                    onChange={(e) => setModelExtra(m.id, parseInt(e.target.value, 10) || 0)}
                  />
                  <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">{m.id}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium mb-2">Предпросмотр (итоговые кредиты)</p>
            <ul className="space-y-1.5 text-sm">
              {previewRows.map((row) => (
                <li key={row.variant + row.modelId} className="flex justify-between gap-4 border-b border-border/50 py-1 last:border-0">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono tabular-nums">
                    {row.credits != null ? row.credits : "—"} <span className="text-xs text-muted-foreground">{row.variant}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Button onClick={handleSaveVideoFormula} disabled={formulaSaving}>
            {formulaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Сохранить формулу цен
          </Button>
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
