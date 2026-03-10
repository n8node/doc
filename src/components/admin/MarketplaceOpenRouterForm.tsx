"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, Store, Wifi, CheckCircle } from "lucide-react";

export function MarketplaceOpenRouterForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; modelsCount?: number } | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/marketplace-openrouter")
      .then((r) => r.json())
      .then((data) => {
        if (data.apiKeySet) {
          setApiKey("••••••••");
        }
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: { apiKey?: string } = {};
      if (apiKey && apiKey !== "••••••••" && apiKey !== "********") {
        body.apiKey = apiKey;
      }
      const res = await fetch("/api/v1/admin/marketplace-openrouter/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok ?? false,
        message: data.message ?? (data.ok ? "Подключение успешно!" : "Ошибка"),
        modelsCount: data.modelsCount,
      });
      if (data.ok) {
        toast.success(data.message ?? "Подключение успешно!");
      } else {
        toast.error(data.message ?? "Ошибка подключения");
      }
    } catch {
      setTestResult({ ok: false, message: "Ошибка запроса" });
      toast.error("Ошибка запроса");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: { apiKey?: string } = {};
      if (apiKey && apiKey !== "••••••••" && apiKey !== "********") {
        body.apiKey = apiKey;
      }
      const res = await fetch("/api/v1/admin/marketplace-openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      if (apiKey && apiKey !== "••••••••") {
        setApiKey("••••••••");
      }
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Store className="h-5 w-5" />
          OpenRouter для API-маркетплейса
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Отдельный API-ключ OpenRouter для прокси маркетплейса LLM. Не связан с провайдерами для работы с документами (эмбеддинг, чат, поиск).
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            API-ключ OpenRouter
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ключ с openrouter.ai для прокси запросов маркетплейса. Хранится в зашифрованном виде.
          </p>
          <div className="relative mt-1 max-w-md">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowApiKey((s) => !s)}
              aria-label={showApiKey ? "Скрыть" : "Показать"}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Оставьте пустым или «••••••••», чтобы не менять сохранённый ключ.
          </p>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
              testResult.ok
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle className="h-5 w-5 shrink-0" />
            ) : (
              <Wifi className="h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-medium">{testResult.message}</p>
              {testResult.ok && testResult.modelsCount != null && (
                <p className="text-xs opacity-80">Моделей: {testResult.modelsCount}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-1.5">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Проверить соединение
        </Button>
        </div>
      </div>
    </div>
  );
}
