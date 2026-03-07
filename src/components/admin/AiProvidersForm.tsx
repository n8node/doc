"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  X,
  BrainCircuit,
  Eye,
  EyeOff,
  Zap,
  BarChart3,
  Mic2,
  FileCode2,
  MessageSquare,
  Search,
} from "lucide-react";

interface ProviderItem {
  id: string;
  name: string;
  type: string;
  purpose: "EMBEDDING_CHAT" | "TRANSCRIPTION";
  baseUrl: string | null;
  modelName: string | null;
  chatModelName: string | null;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  folderId: string | null;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

const PROVIDER_PRESETS: Record<
  string,
  { label: string; type: string; baseUrl: string; modelName: string; chatModelName: string; needsFolderId: boolean }
> = {
  openai: {
    label: "OpenAI",
    type: "CLOUD",
    baseUrl: "https://api.openai.com/v1",
    modelName: "text-embedding-3-small",
    chatModelName: "gpt-4o-mini",
    needsFolderId: false,
  },
  openrouter: {
    label: "OpenRouter",
    type: "CLOUD",
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/text-embedding-3-small",
    chatModelName: "openai/gpt-4o-mini",
    needsFolderId: false,
  },
  yandex: {
    label: "YandexGPT",
    type: "CLOUD",
    baseUrl: "https://llm.api.cloud.yandex.net",
    modelName: "general:embedding",
    chatModelName: "yandexgpt",
    needsFolderId: true,
  },
  gigachat: {
    label: "GigaChat",
    type: "CLOUD",
    baseUrl: "https://gigachat.devices.sberbank.ru/api/v1",
    modelName: "Embeddings",
    chatModelName: "GigaChat",
    needsFolderId: false,
  },
};

const TRANSCRIPTION_PROVIDER_PRESETS: Record<
  string,
  { label: string; type: string; baseUrl: string; modelName: string; needsFolderId: boolean }
> = {
  yandex_speechkit: {
    label: "Yandex SpeechKit",
    type: "CLOUD",
    baseUrl: "https://stt.api.cloud.yandex.net",
    modelName: "general",
    needsFolderId: true,
  },
  openai_whisper: {
    label: "OpenAI Whisper API",
    type: "CLOUD",
    baseUrl: "https://api.openai.com/v1",
    modelName: "whisper-1",
    needsFolderId: false,
  },
};

function TranscriptionProviderCard({
  provider,
  onUpdate,
  onDelete,
}: {
  provider: ProviderItem;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const preset = TRANSCRIPTION_PROVIDER_PRESETS[provider.name];

  const [form, setForm] = useState({
    baseUrl: provider.baseUrl ?? "",
    modelName: provider.modelName ?? "",
    apiKey: "",
    folderId: provider.folderId ?? "",
    isActive: provider.isActive,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        baseUrl: form.baseUrl,
        modelName: form.modelName,
        isActive: form.isActive,
        folderId: form.folderId || null,
      };
      if (form.apiKey.trim()) body.apiKey = form.apiKey;

      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success(`${preset?.label ?? provider.name} обновлён`);
      setEditing(false);
      setForm((f) => ({ ...f, apiKey: "" }));
      onUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить провайдер "${preset?.label ?? provider.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success("Провайдер удалён");
      onDelete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface2/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              provider.isActive ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
            }`}
          >
            <Mic2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">{preset?.label ?? provider.name}</p>
            <p className="text-xs text-muted-foreground">
              Модель: {provider.modelName ?? "—"}
              {provider.isActive ? (
                <span className="ml-2 text-amber-500">● Активен</span>
              ) : (
                <span className="ml-2 text-muted-foreground">○ Неактивен</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Настроить
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="ml-1">Сохранить</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    baseUrl: provider.baseUrl ?? "",
                    modelName: provider.modelName ?? "",
                    apiKey: "",
                    folderId: provider.folderId ?? "",
                    isActive: provider.isActive,
                  });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Base URL</label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder={preset?.baseUrl ?? "https://..."}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Модель ASR</label>
              <Input
                value={form.modelName}
                onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                placeholder={preset?.modelName ?? "model-name"}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              API-ключ {provider.hasApiKey && <span className="text-emerald-500">(установлен)</span>}
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={provider.hasApiKey ? "Оставьте пустым, чтобы не менять" : "sk-..."}
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

          {(preset?.needsFolderId || provider.folderId) && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Folder ID (Yandex Cloud)
              </label>
              <Input
                value={form.folderId}
                onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value }))}
                placeholder="b1g..."
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Активен (премиум-транскрибация)
            </label>
            <Button
              size="sm"
              variant="ghost"
              className="text-error hover:text-error"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1">Удалить</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  onUpdate,
  onDelete,
}: {
  provider: ProviderItem;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    dimensions?: number;
    model?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const preset = PROVIDER_PRESETS[provider.name];

  const [form, setForm] = useState({
    baseUrl: provider.baseUrl ?? "",
    modelName: provider.modelName ?? "",
    chatModelName: provider.chatModelName ?? "",
    apiKey: "",
    folderId: provider.folderId ?? "",
    isActive: provider.isActive,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        baseUrl: form.baseUrl,
        modelName: form.modelName,
        chatModelName: form.chatModelName || null,
        isActive: form.isActive,
        folderId: form.folderId || null,
      };
      if (form.apiKey.trim()) body.apiKey = form.apiKey;

      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success(`${preset?.label ?? provider.name} обновлён`);
      setEditing(false);
      setForm((f) => ({ ...f, apiKey: "" }));
      onUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить провайдер "${preset?.label ?? provider.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success("Провайдер удалён");
      onDelete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast.success(`Соединение успешно (${data.latencyMs}ms, ${data.dimensions}d)`);
      } else {
        toast.error(data.error ?? "Ошибка соединения");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сети";
      setTestResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface2/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              provider.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
            }`}
          >
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {preset?.label ?? provider.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Embed: {provider.modelName ?? "—"} | Chat: {provider.chatModelName ?? "—"}
              {provider.isActive ? (
                <span className="ml-2 text-emerald-500">● Активен</span>
              ) : (
                <span className="ml-2 text-muted-foreground">○ Неактивен</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Настроить
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="ml-1">Сохранить</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    baseUrl: provider.baseUrl ?? "",
                    modelName: provider.modelName ?? "",
                    chatModelName: provider.chatModelName ?? "",
                    apiKey: "",
                    folderId: provider.folderId ?? "",
                    isActive: provider.isActive,
                  });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Base URL
              </label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder={preset?.baseUrl ?? "https://..."}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Модель эмбеддинга
              </label>
              <Input
                value={form.modelName}
                onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                placeholder={preset?.modelName ?? "model-name"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Модель чата (RAG)
              </label>
              <Input
                value={form.chatModelName}
                onChange={(e) => setForm((f) => ({ ...f, chatModelName: e.target.value }))}
                placeholder={preset?.chatModelName ?? "chat-model"}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              API-ключ {provider.hasApiKey && <span className="text-emerald-500">(установлен: {provider.apiKeyMasked})</span>}
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={provider.hasApiKey ? "Оставьте пустым, чтобы не менять" : "sk-..."}
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

          {(preset?.needsFolderId || provider.folderId) && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Folder ID (Yandex Cloud)
              </label>
              <Input
                value={form.folderId}
                onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value }))}
                placeholder="b1g..."
              />
            </div>
          )}

          {provider.hasApiKey && (
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={testing}
                className="gap-1.5"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Проверить соединение
              </Button>

              {testResult && (
                <div
                  className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                    testResult.ok
                      ? "border border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                      : "border border-error/20 bg-error/5 text-error"
                  }`}
                >
                  {testResult.ok ? (
                    <span>
                      Соединение установлено — модель: <strong>{testResult.model}</strong>,
                      размерность: <strong>{testResult.dimensions}</strong>,
                      задержка: <strong>{testResult.latencyMs}ms</strong>
                    </span>
                  ) : (
                    <span>Ошибка: {testResult.error}</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Активен (эмбеддинг, чат, поиск)
            </label>
            <Button
              size="sm"
              variant="ghost"
              className="text-error hover:text-error"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1">Удалить</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiProvidersForm() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [embeddingStats, setEmbeddingStats] = useState<{
    periodDays: number;
    totalTokensUsed: number;
    tasksCount: number;
    byProvider: Array<{ providerName: string; tokensUsed: number; tasksCount: number }>;
  } | null>(null);
  const [statsPeriod, setStatsPeriod] = useState(30);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatPromptSaving, setChatPromptSaving] = useState(false);

  const loadChatPrompt = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai/chat-prompt");
      if (res.ok) {
        const data = await res.json();
        setChatPrompt(data.systemPrompt ?? "");
      }
    } catch {
      setChatPrompt("");
    }
  }, []);

  const saveChatPrompt = useCallback(async () => {
    setChatPromptSaving(true);
    try {
      const res = await fetch("/api/v1/admin/ai/chat-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: chatPrompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success("Промпт чата сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setChatPromptSaving(false);
    }
  }, [chatPrompt]);

  const loadEmbeddingStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/ai/stats?period=${statsPeriod}`);
      if (res.ok) {
        const data = await res.json();
        setEmbeddingStats({
          periodDays: data.periodDays ?? 30,
          totalTokensUsed: data.totalTokensUsed ?? 0,
          tasksCount: data.tasksCount ?? 0,
          byProvider: data.byProvider ?? [],
        });
      } else {
        setEmbeddingStats(null);
      }
    } catch {
      setEmbeddingStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [statsPeriod]);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai/providers");
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {
      toast.error("Не удалось загрузить провайдеров");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);
  useEffect(() => { loadEmbeddingStats(); }, [loadEmbeddingStats]);
  useEffect(() => { loadChatPrompt(); }, [loadChatPrompt]);

  const embeddingProviders = providers.filter(
    (p) => (p.purpose ?? "EMBEDDING_CHAT") === "EMBEDDING_CHAT",
  );
  const activeEmbeddingProvider = embeddingProviders.find((p) => p.isActive) ?? null;
  const transcriptionProviders = providers.filter(
    (p) => p.purpose === "TRANSCRIPTION",
  );

  const existingNames = new Set(providers.map((p) => p.name));
  const availablePresets = Object.entries(PROVIDER_PRESETS).filter(
    ([key]) => !existingNames.has(key),
  );
  const availableTranscriptionPresets = Object.entries(TRANSCRIPTION_PROVIDER_PRESETS).filter(
    ([key]) => !existingNames.has(key),
  );

  const handleAdd = async (name: string) => {
    const preset = PROVIDER_PRESETS[name];
    if (!preset) return;
    setAdding(true);
    try {
      const res = await fetch("/api/v1/admin/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: preset.type,
          baseUrl: preset.baseUrl,
          modelName: preset.modelName,
          chatModelName: preset.chatModelName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success(`${preset.label} добавлен`);
      loadProviders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
    }
  };

  const handleAddTranscription = async (name: string) => {
    const preset = TRANSCRIPTION_PROVIDER_PRESETS[name];
    if (!preset) return;
    setAdding(true);
    try {
      const res = await fetch("/api/v1/admin/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: preset.type,
          purpose: "TRANSCRIPTION",
          baseUrl: preset.baseUrl,
          modelName: preset.modelName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка");
      }
      toast.success(`${preset.label} добавлен`);
      loadProviders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Статистика эмбеддинга (токены)</h3>
          </div>
          <select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-foreground"
          >
            <option value={7}>За 7 дней</option>
            <option value={30}>За 30 дней</option>
            <option value={90}>За 90 дней</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {statsLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : embeddingStats === null ? (
            <p className="text-sm text-muted-foreground">Не удалось загрузить статистику.</p>
          ) : embeddingStats ? (
            <>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Всего токенов</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {embeddingStats.totalTokensUsed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Обработок документов</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {embeddingStats.tasksCount}
                  </p>
                </div>
              </div>
              {embeddingStats.byProvider.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[280px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface2/50">
                        <th className="px-3 py-2 text-left font-medium text-foreground">Провайдер</th>
                        <th className="px-3 py-2 text-right font-medium text-foreground">Токенов</th>
                        <th className="px-3 py-2 text-right font-medium text-foreground">Задач</th>
                      </tr>
                    </thead>
                    <tbody>
                      {embeddingStats.byProvider.map((row) => (
                        <tr key={row.providerName} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 text-foreground">{row.providerName}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">
                            {row.tokensUsed.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {row.tasksCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {embeddingStats.tasksCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  За выбранный период завершённых задач эмбеддинга нет. Токены учитываются после успешной обработки документа.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface2/30 p-4">
        <h3 className="text-sm font-semibold text-foreground">Промпт чата по документу (RAG)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Системная инструкция для AI при ответах на вопросы по документу. Будет дополнена контекстом из документа.
        </p>
        <textarea
          value={chatPrompt}
          onChange={(e) => setChatPrompt(e.target.value)}
          placeholder="Ты — полезный ассистент. Отвечай на вопросы пользователя на основе контекста из документа..."
          rows={4}
          className="mt-3 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <Button
          size="sm"
          onClick={saveChatPrompt}
          disabled={chatPromptSaving}
          className="mt-2 gap-1.5"
        >
          {chatPromptSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить промпт
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Провайдеры для работы с документами</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Один активный провайдер используется для всех трёх функций. Добавьте и активируйте нужный.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface2/30 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <FileCode2 className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Эмбеддинг документов</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Создание векторных представлений при обработке и загрузке документов.
          </p>
          <div className="mt-2">
            {activeEmbeddingProvider ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {PROVIDER_PRESETS[activeEmbeddingProvider.name]?.label ?? activeEmbeddingProvider.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Нет активного провайдера</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface2/30 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Чат с документом</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ответы на вопросы пользователя по содержанию документа (RAG).
          </p>
          <div className="mt-2">
            {activeEmbeddingProvider ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {PROVIDER_PRESETS[activeEmbeddingProvider.name]?.label ?? activeEmbeddingProvider.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Нет активного провайдера</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface2/30 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Search className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Семантический поиск</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Поиск по смыслу, а не по ключевым словам в файлах.
          </p>
          <div className="mt-2">
            {activeEmbeddingProvider ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {PROVIDER_PRESETS[activeEmbeddingProvider.name]?.label ?? activeEmbeddingProvider.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Нет активного провайдера</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Провайдеры (общие для всех функций)
      </p>

      {embeddingProviders.length > 0 && (
        <div className="space-y-3">
          {embeddingProviders.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onUpdate={loadProviders}
              onDelete={loadProviders}
            />
          ))}
        </div>
      )}

      {embeddingProviders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface2/20 p-8 text-center">
          <BrainCircuit className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Нет подключённых провайдеров эмбеддинга. Добавьте хотя бы один для работы AI-функций.
          </p>
        </div>
      )}

      {availablePresets.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Добавить провайдер
          </p>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map(([key, preset]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                disabled={adding}
                onClick={() => handleAdd(key)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-6">
        <h2 className="text-lg font-semibold text-foreground">Провайдеры транскрибации</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Опционально. Премиум-провайдеры для более качественной транскрибации аудио и видео.
          По умолчанию используется QoQon (Whisper).
        </p>
      </div>

      {transcriptionProviders.length > 0 && (
        <div className="mt-3 space-y-3">
          {transcriptionProviders.map((p) => (
            <TranscriptionProviderCard
              key={p.id}
              provider={p}
              onUpdate={loadProviders}
              onDelete={loadProviders}
            />
          ))}
        </div>
      )}

      {transcriptionProviders.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-surface2/20 p-6 text-center">
          <Mic2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Нет провайдеров транскрибации. Добавьте при необходимости премиум-ASR.
          </p>
        </div>
      )}

      {availableTranscriptionPresets.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Добавить провайдер транскрибации
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTranscriptionPresets.map(([key, preset]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                disabled={adding}
                onClick={() => handleAddTranscription(key)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
