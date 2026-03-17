"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, Wifi, CheckCircle, ImageIcon, Percent, ListOrdered } from "lucide-react";

interface ImageTaskConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface ImageModelConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  taskIds: string[];
  order: number;
}

const TASK_OPTIONS: { id: string; label: string }[] = [
  { id: "text_to_image", label: "Генерация по описанию" },
  { id: "edit_image", label: "Редактирование по промпту" },
  { id: "variations", label: "Вариации по образцу" },
];

const MODEL_OPTIONS: { id: string; name: string; description: string }[] = [
  { id: "kie-4o-image", name: "4o Image", description: "Фотореализм, работа с текстом" },
  { id: "kie-flux-kontext", name: "Flux Kontext", description: "Стилизованные сцены" },
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
  const [tasks, setTasks] = useState<ImageTaskConfig[]>([]);
  const [models, setModels] = useState<ImageModelConfig[]>([]);

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
        setTasks(Array.isArray(config.imageTasks) && config.imageTasks.length > 0 ? config.imageTasks : TASK_OPTIONS.map((t, i) => ({ ...t, enabled: true, order: i + 1 })));
        setModels(Array.isArray(config.imageModels) && config.imageModels.length > 0 ? config.imageModels : MODEL_OPTIONS.map((m, i) => ({ ...m, enabled: true, taskIds: m.id === "kie-4o-image" ? ["text_to_image", "edit_image", "variations"] : ["text_to_image", "edit_image"], order: i + 1 })));
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

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
          </div>
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleModel(m.id)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="font-medium">{m.name}</span>
                    {m.description && <span className="text-muted-foreground text-sm">— {m.description}</span>}
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
          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
