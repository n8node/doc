"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, Copy, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

interface LlmKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WalletData {
  balanceCents: number;
  topups: { id: string; amountCents: number; status: string; createdAt: string; succeededAt: string | null }[];
  usage: { id: string; category: string; model: string; tokensIn: number; tokensOut: number; costCents: number; createdAt: string }[];
}

interface ModelItem {
  id: string;
  name: string;
  category: string;
  contextLength: number | null;
  pricing: Record<string, string> | null;
}

const CATEGORIES = [
  { id: "", label: "Все", icon: "📋" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "embeddings", label: "Embeddings", icon: "📐" },
  { id: "image", label: "Изображения", icon: "🖼️" },
  { id: "audio", label: "Аудио", icon: "🎙️" },
  { id: "video", label: "Видео", icon: "🎬" },
];

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [llmKeys, setLlmKeys] = useState<LlmKeyItem[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState("100");
  const [topupLoading, setTopupLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModels, setShowModels] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [keysSettled, walletSettled] = await Promise.allSettled([
      fetch("/api/v1/user/llm-api-keys").then((r) => r.json().catch(() => ({}))),
      fetch("/api/v1/user/llm-wallet").then((r) => r.json().catch(() => ({}))),
    ]);
    let anyOk = false;
    if (keysSettled.status === "fulfilled" && keysSettled.value?.keys && Array.isArray(keysSettled.value.keys)) {
      setLlmKeys(keysSettled.value.keys);
      anyOk = true;
    }
    if (walletSettled.status === "fulfilled" && walletSettled.value?.balanceCents !== undefined) {
      const w = walletSettled.value;
      setWallet({
        balanceCents: w.balanceCents,
        topups: w.topups ?? [],
        usage: w.usage ?? [],
      });
      anyOk = true;
    }
    if (!anyOk && (keysSettled.status === "rejected" || walletSettled.status === "rejected")) {
      toast.error("Не удалось загрузить данные");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && llmKeys.length > 0 && !showModels && models.length === 0) {
      loadModels();
    }
  }, [loading, llmKeys.length, showModels, models.length]);

  useEffect(() => {
    if (searchParams.get("topup") === "success") {
      toast.success("Баланс пополнен!");
      loadData();
    }
  }, [searchParams, loadData]);

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const res = await fetch(`/api/v1/user/marketplace-models${categoryFilter ? `?category=${categoryFilter}` : ""}`);
      const data = await res.json();
      if (data.data) setModels(data.data);
      setShowModels(true);
    } catch {
      toast.error("Не удалось загрузить каталог");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const res = await fetch("/api/v1/user/llm-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() || "LLM Key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setLlmKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix ?? "QoQon_LLM_...",
          lastUsedAt: null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewKeyName("");
      setNewKeyValue(data.key ?? null);
      toast.success("Ключ создан. Сохраните его — он больше не будет показан.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка создания ключа");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setDeletingKeyId(id);
    try {
      const res = await fetch(`/api/v1/user/llm-api-keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setLlmKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Ключ удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleTopup = async () => {
    const rub = parseInt(topupAmount, 10);
    if (isNaN(rub) || rub < 10) {
      toast.error("Минимальная сумма — 10 ₽");
      return;
    }
    setTopupLoading(true);
    try {
      const res = await fetch("/api/v1/user/llm-wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: rub * 100 }),
      });
      const text = await res.text();
      let data: { error?: string; confirmationUrl?: string } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = { error: "Некорректный ответ сервера" };
      }
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка пополнения");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleCopy = (val: string) => {
    void navigator.clipboard.writeText(val);
    toast.success("Скопировано");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка…
      </div>
    );
  }

  const balanceRub = ((wallet?.balanceCents ?? 0) / 100).toFixed(2);

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">API маркетплейс LLM</h1>
        <p className="mt-1 text-muted-foreground">
          Доступ к моделям OpenRouter через единый API. Chat, эмбеддинги, изображения, аудио и видео — один ключ и одна оплата.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] items-start">
        {/* Левая колонка: ключи и кошелёк */}
        <div className="space-y-6">
          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Баланс
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Пополняйте баланс — списание идёт по мере использования API.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-surface2/50 px-4 py-3">
                <p className="text-sm text-muted-foreground">Доступно</p>
                <p className="text-2xl font-bold text-foreground">{balanceRub} ₽</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Пополнить (₽)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={10}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="100"
                    className="max-w-[120px]"
                  />
                  <Button onClick={handleTopup} disabled={topupLoading}>
                    {topupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Пополнить
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>

          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API-ключи LLM
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ключи с префиксом <code className="rounded bg-surface2 px-1">QoQon_LLM_</code> — только для маркетплейса.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateKey} className="flex gap-2">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Например: production"
                  className="flex-1"
                />
                <Button type="submit" disabled={creatingKey}>
                  {creatingKey && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </Button>
              </form>
              {newKeyValue && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                  <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    Сохраните ключ — он больше не будет показан
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-surface2 px-2 py-1 text-sm font-mono">{newKeyValue}</code>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(newKeyValue)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setNewKeyValue(null)}>
                      Закрыть
                    </Button>
                  </div>
                </div>
              )}
              {llmKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет ключей. Создайте первый.</p>
              ) : (
                <ul className="space-y-2">
                  {llmKeys.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2/50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{k.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {k.keyPrefix}
                          {k.lastUsedAt ? ` · Использован ${new Date(k.lastUsedAt).toLocaleString("ru-RU")}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deletingKeyId === k.id}
                        onClick={() => handleDeleteKey(k.id)}
                      >
                        {deletingKeyId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Удалить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </div>
        </div>

        {/* Правая колонка: каталог и документация */}
        <div className="space-y-6">
          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle>Каталог моделей</CardTitle>
              <p className="text-sm text-muted-foreground">
                5 категорий: Chat, Embeddings, Изображения, Аудио, Видео.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORIES.map((c) => (
                  <Button
                    key={c.id}
                    variant={categoryFilter === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(c.id)}
                  >
                    {c.icon} {c.label}
                  </Button>
                ))}
              </div>
              <Button variant="outline" onClick={loadModels} disabled={modelsLoading} className="gap-1.5">
                {modelsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {showModels ? "Обновить" : "Загрузить"} каталог
              </Button>
              {showModels && models.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 max-h-80 overflow-y-auto space-y-1"
                >
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface2/30 px-3 py-2 text-sm"
                    >
                      <span className="font-mono truncate">{m.id}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{m.category}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </div>

          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle>Использование API</CardTitle>
              <p className="text-sm text-muted-foreground">
                Chat completions: <code className="rounded bg-surface2 px-1">POST /api/v1/marketplace/chat/completions</code>.
                Embeddings: <code className="rounded bg-surface2 px-1">POST /api/v1/marketplace/embeddings</code>.
              </p>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-surface2 p-4 text-sm">
{`curl -X POST "https://qoqon.ru/api/v1/marketplace/chat/completions" \\
  -H "Authorization: Bearer QoQon_LLM_xxx__yyy" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Привет"}]}'`}
              </pre>
            </CardContent>
          </div>

          {wallet && (wallet.usage.length > 0 || wallet.topups.length > 0) && (
            <div className="rounded-2xl modal-glass overflow-hidden">
              <CardHeader>
                <CardTitle>История</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {wallet.usage.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Использование</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {wallet.usage.slice(0, 10).map((u) => (
                        <div
                          key={u.id}
                          className="flex justify-between text-sm rounded-lg px-3 py-2 bg-surface2/30"
                        >
                          <span>{u.model} · {u.tokensIn + u.tokensOut} tok</span>
                          <span className="text-muted-foreground">−{(u.costCents / 100).toFixed(2)} ₽</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {wallet.topups.filter((t) => t.status === "succeeded").length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Пополнения</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {wallet.topups.filter((t) => t.status === "succeeded").slice(0, 5).map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between text-sm rounded-lg px-3 py-2 bg-surface2/30"
                        >
                          <span>{(t.amountCents / 100).toFixed(2)} ₽</span>
                          <span className="text-emerald-600">+</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
