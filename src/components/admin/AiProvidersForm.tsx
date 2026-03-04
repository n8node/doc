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
} from "lucide-react";

interface ProviderItem {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  modelName: string | null;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  folderId: string | null;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

const PROVIDER_PRESETS: Record<
  string,
  { label: string; type: string; baseUrl: string; modelName: string; needsFolderId: boolean }
> = {
  openai: {
    label: "OpenAI",
    type: "CLOUD",
    baseUrl: "https://api.openai.com/v1",
    modelName: "text-embedding-3-small",
    needsFolderId: false,
  },
  openrouter: {
    label: "OpenRouter",
    type: "CLOUD",
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/text-embedding-3-small",
    needsFolderId: false,
  },
  yandex: {
    label: "YandexGPT",
    type: "CLOUD",
    baseUrl: "https://llm.api.cloud.yandex.net",
    modelName: "general:embedding",
    needsFolderId: true,
  },
  gigachat: {
    label: "GigaChat",
    type: "CLOUD",
    baseUrl: "https://gigachat.devices.sberbank.ru/api/v1",
    modelName: "Embeddings",
    needsFolderId: false,
  },
};

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
  const [showApiKey, setShowApiKey] = useState(false);
  const preset = PROVIDER_PRESETS[provider.name];

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

      const res = await fetch(`/api/admin/ai/providers/${provider.id}`, {
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
      const res = await fetch(`/api/admin/ai/providers/${provider.id}`, {
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
              {provider.modelName ?? "модель не указана"}
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
                Модель
              </label>
              <Input
                value={form.modelName}
                onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                placeholder={preset?.modelName ?? "model-name"}
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

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Активен (использовать для embeddings)
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

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/providers");
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {
      toast.error("Не удалось загрузить провайдеров");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const existingNames = new Set(providers.map((p) => p.name));
  const availablePresets = Object.entries(PROVIDER_PRESETS).filter(
    ([key]) => !existingNames.has(key),
  );

  const handleAdd = async (name: string) => {
    const preset = PROVIDER_PRESETS[name];
    if (!preset) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: preset.type,
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
      <div>
        <h2 className="text-lg font-semibold text-foreground">AI-провайдеры</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Подключите нейросеть для генерации embeddings и семантического поиска по документам.
          Нужен хотя бы один активный провайдер.
        </p>
      </div>

      {providers.length > 0 && (
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onUpdate={loadProviders}
              onDelete={loadProviders}
            />
          ))}
        </div>
      )}

      {providers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface2/20 p-8 text-center">
          <BrainCircuit className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Нет подключённых провайдеров. Добавьте хотя бы один для работы AI-функций.
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
    </div>
  );
}
