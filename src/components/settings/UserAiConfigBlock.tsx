"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, Eye, EyeOff, Zap, ChevronDown, ChevronUp } from "lucide-react";

const PROVIDER_OPTIONS: Record<
  string,
  { label: string; baseUrl: string; needsFolderId: boolean }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    needsFolderId: false,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    needsFolderId: false,
  },
  yandex: {
    label: "YandexGPT",
    baseUrl: "https://llm.api.cloud.yandex.net",
    needsFolderId: true,
  },
  gigachat: {
    label: "GigaChat",
    baseUrl: "https://gigachat.devices.sberbank.ru/api/v1",
    needsFolderId: false,
  },
};

interface EmbeddingConfigInput {
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number | null;
  similarityThreshold?: number;
  topK?: number;
}

interface AiConfig {
  id: string;
  providerName: string;
  baseUrl: string | null;
  embeddingModel: string;
  chatModel: string;
  embeddingConfig?: EmbeddingConfigInput | null;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  folderId: string | null;
  updatedAt: string;
}

interface ModelInfo {
  id: string;
  name?: string;
}

export function UserAiConfigBlock() {
  const [canUseOwnKeys, setCanUseOwnKeys] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [providerName, setProviderName] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [folderId, setFolderId] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [embedConfigOpen, setEmbedConfigOpen] = useState(false);
  const [embedChunkSize, setEmbedChunkSize] = useState("");
  const [embedChunkOverlap, setEmbedChunkOverlap] = useState("");
  const [embedDimensions, setEmbedDimensions] = useState("");
  const [embedThreshold, setEmbedThreshold] = useState("");
  const [embedTopK, setEmbedTopK] = useState("");

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    dimensions?: number;
    embeddingModels?: ModelInfo[];
    chatModels?: ModelInfo[];
    error?: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/user/ai-config");
      const data = await res.json();
      setCanUseOwnKeys(!!data.canUseOwnKeys);
      if (data.config) {
        setConfig(data.config);
        setProviderName(data.config.providerName);
        setBaseUrl(data.config.baseUrl ?? PROVIDER_OPTIONS[data.config.providerName]?.baseUrl ?? "");
        setFolderId(data.config.folderId ?? "");
        setEmbeddingModel(data.config.embeddingModel);
        setChatModel(data.config.chatModel);
        setIsActive(data.config.isActive);
        const ec = data.config.embeddingConfig as EmbeddingConfigInput | undefined;
        setEmbedChunkSize(ec?.chunkSize != null ? String(ec.chunkSize) : "");
        setEmbedChunkOverlap(ec?.chunkOverlap != null ? String(ec.chunkOverlap) : "");
        setEmbedDimensions(ec?.dimensions != null ? String(ec.dimensions) : "");
        setEmbedThreshold(ec?.similarityThreshold != null ? String(ec.similarityThreshold) : "");
        setEmbedTopK(ec?.topK != null ? String(ec.topK) : "");
      } else if (data.canUseOwnKeys) {
        setProviderName("openai");
        setBaseUrl(PROVIDER_OPTIONS.openai.baseUrl);
        setFolderId("");
        setEmbeddingModel("text-embedding-3-small");
        setChatModel("gpt-4o-mini");
        setIsActive(false);
      }
    } catch {
      toast.error("Не удалось загрузить настройки AI");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const preset = PROVIDER_OPTIONS[providerName];
    if (preset && !config) {
      setBaseUrl(preset.baseUrl);
    }
  }, [providerName, config]);

  const handleTest = async () => {
    if (!apiKey.trim() && !config?.hasApiKey) {
      toast.error("Введите API-ключ");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/user/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          folderId: folderId.trim() || undefined,
          useStoredKey: !apiKey.trim() && !!config?.hasApiKey,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast.success(`Соединение установлено (${data.dimensions}d)`);
        if (data.embeddingModels?.length) {
          setEmbeddingModel(data.embeddingModels[0].id);
        }
        if (data.chatModels?.length) {
          setChatModel(data.chatModels[0].id);
        }
      } else {
        toast.error(data.error ?? "Ошибка соединения");
      }
    } catch {
      toast.error("Ошибка проверки");
    } finally {
      setTesting(false);
    }
  };

  const buildEmbeddingConfig = (): EmbeddingConfigInput | null => {
    const chunkSize = embedChunkSize.trim() ? parseInt(embedChunkSize, 10) : undefined;
    const chunkOverlap = embedChunkOverlap.trim() ? parseInt(embedChunkOverlap, 10) : undefined;
    const dimensions = embedDimensions.trim() === "" ? undefined : embedDimensions.trim() === "0" ? null : parseInt(embedDimensions, 10);
    const similarityThreshold = embedThreshold.trim() ? parseFloat(embedThreshold) : undefined;
    const topK = embedTopK.trim() ? parseInt(embedTopK, 10) : undefined;
    if (chunkSize == null && chunkOverlap == null && dimensions === undefined && similarityThreshold == null && topK == null) {
      return null;
    }
    const cfg: EmbeddingConfigInput = {};
    if (chunkSize != null && !Number.isNaN(chunkSize)) cfg.chunkSize = Math.min(2000, Math.max(100, chunkSize));
    if (chunkOverlap != null && !Number.isNaN(chunkOverlap)) cfg.chunkOverlap = Math.min(200, Math.max(0, chunkOverlap));
    if (dimensions === null) cfg.dimensions = null;
    else if (dimensions != null && !Number.isNaN(dimensions)) cfg.dimensions = Math.min(3072, Math.max(256, dimensions));
    if (similarityThreshold != null && !Number.isNaN(similarityThreshold)) cfg.similarityThreshold = Math.min(0.95, Math.max(0.3, similarityThreshold));
    if (topK != null && !Number.isNaN(topK)) cfg.topK = Math.min(50, Math.max(1, topK));
    return Object.keys(cfg).length > 0 ? cfg : null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const embeddingConfig = buildEmbeddingConfig();
      const res = await fetch("/api/v1/user/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          folderId: folderId.trim() || undefined,
          embeddingModel: embeddingModel || "text-embedding-3-small",
          chatModel: chatModel || "gpt-4o-mini",
          embeddingConfig,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      setConfig(data.config);
      setApiKey("");
      toast.success("Настройки сохранены");
      loadConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/user/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setIsActive(false);
      setConfig((c) => (c ? { ...c, isActive: false } : null));
      toast.success("Используется системный ключ");
      loadConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка...
      </div>
    );
  }

  if (!canUseOwnKeys) return null;

  const preset = PROVIDER_OPTIONS[providerName];
  const needsFolderId = preset?.needsFolderId ?? false;

  return (
    <div className="rounded-2xl modal-glass overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Свой API-ключ для AI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Используйте свой ключ OpenAI/OpenRouter — токены не списываются с вашего тарифа.
          Модель для эмбеддинга, чата и поиска должна быть единой (одинаковая размерность векторов).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {config?.isActive && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            Используется ваш ключ. Токены не списываются.
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Провайдер</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROVIDER_OPTIONS).map(([key, { label, baseUrl: url }]) => (
              <Button
                key={key}
                type="button"
                variant={providerName === key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setProviderName(key);
                  setBaseUrl(url);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            API-ключ {config?.hasApiKey && isActive && <span className="text-emerald-500">(установлен)</span>}
          </label>
          <div className="relative max-w-md">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.hasApiKey ? "Оставьте пустым, чтобы не менять" : "sk-..."}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Base URL</label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={preset?.baseUrl ?? "https://..."}
            className="max-w-md"
          />
        </div>

        {needsFolderId && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Folder ID (Yandex Cloud)
            </label>
            <Input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="b1g..."
              className="max-w-md"
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          className="gap-1.5"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Проверить соединение
        </Button>

        {testResult?.ok && (
          <div className="space-y-3 rounded-lg border border-border bg-surface2/30 p-4">
            <p className="text-sm font-medium text-emerald-600">Соединение установлено</p>
            {testResult.embeddingModels && testResult.embeddingModels.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Модель эмбеддинга и поиска
                </label>
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  {testResult.embeddingModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {testResult.chatModels && testResult.chatModels.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Модель чата
                </label>
                <select
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  {testResult.chatModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {(!testResult?.ok || !testResult.embeddingModels?.length) && (
          <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Модель эмбеддинга и поиска
                  </label>
                  <Input
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="text-embedding-3-small"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Модель чата
                  </label>
                  <Input
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setEmbedConfigOpen((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-medium text-foreground hover:text-primary"
          >
            Параметры векторизации (чанкинг, dimensions, поиск)
            {embedConfigOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {embedConfigOpen && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Размер чанка (символов)</label>
                <Input
                  type="number"
                  min={100}
                  max={2000}
                  value={embedChunkSize}
                  onChange={(e) => setEmbedChunkSize(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Перекрытие чанков</label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={embedChunkOverlap}
                  onChange={(e) => setEmbedChunkOverlap(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Dimensions (OpenAI, 256–3072, пусто = по умолчанию)</label>
                <Input
                  type="number"
                  min={256}
                  max={3072}
                  value={embedDimensions}
                  onChange={(e) => setEmbedDimensions(e.target.value)}
                  placeholder="по умолчанию"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Порог схожести (0.3–0.95)</label>
                <Input
                  type="number"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={embedThreshold}
                  onChange={(e) => setEmbedThreshold(e.target.value)}
                  placeholder="0.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Число чанков в контексте (topK)</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={embedTopK}
                  onChange={(e) => setEmbedTopK(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Использовать свой ключ
          </label>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Сохранить
          </Button>
          {config?.isActive && (
            <Button size="sm" variant="outline" onClick={handleDeactivate} disabled={saving}>
              Отключить (использовать системный)
            </Button>
          )}
        </div>

      </CardContent>
    </div>
  );
}
