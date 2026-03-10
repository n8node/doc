"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Settings2, ChevronDown, ChevronUp } from "lucide-react";

interface EmbeddingConfigInput {
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number | null;
  similarityThreshold?: number;
  topK?: number;
}

export function EmbeddingConfigBlockForSystemKeys() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [chunkSize, setChunkSize] = useState("");
  const [chunkOverlap, setChunkOverlap] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [similarityThreshold, setSimilarityThreshold] = useState("");
  const [topK, setTopK] = useState("");

  const load = useCallback(async () => {
    try {
      const prefsRes = await fetch("/api/v1/user/preferences");
      const prefsData = await prefsRes.json();
      const ec = prefsData.embeddingConfig as EmbeddingConfigInput | undefined;
      setChunkSize(ec?.chunkSize != null ? String(ec.chunkSize) : "");
      setChunkOverlap(ec?.chunkOverlap != null ? String(ec.chunkOverlap) : "");
      setDimensions(ec?.dimensions != null ? String(ec.dimensions) : "");
      setSimilarityThreshold(ec?.similarityThreshold != null ? String(ec.similarityThreshold) : "");
      setTopK(ec?.topK != null ? String(ec.topK) : "");
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buildConfig = (): EmbeddingConfigInput | null => {
    const cfg: EmbeddingConfigInput = {};
    const cs = chunkSize.trim() ? parseInt(chunkSize, 10) : undefined;
    const co = chunkOverlap.trim() ? parseInt(chunkOverlap, 10) : undefined;
    const dim = dimensions.trim() === "" ? undefined : dimensions.trim() === "0" ? null : parseInt(dimensions, 10);
    const th = similarityThreshold.trim() ? parseFloat(similarityThreshold) : undefined;
    const tk = topK.trim() ? parseInt(topK, 10) : undefined;
    if (cs != null && !Number.isNaN(cs)) cfg.chunkSize = Math.min(2000, Math.max(100, cs));
    if (co != null && !Number.isNaN(co)) cfg.chunkOverlap = Math.min(200, Math.max(0, co));
    if (dim === null) cfg.dimensions = null;
    else if (dim != null && !Number.isNaN(dim)) cfg.dimensions = Math.min(3072, Math.max(256, dim));
    if (th != null && !Number.isNaN(th)) cfg.similarityThreshold = Math.min(0.95, Math.max(0.3, th));
    if (tk != null && !Number.isNaN(tk)) cfg.topK = Math.min(50, Math.max(1, tk));
    return Object.keys(cfg).length > 0 ? cfg : null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const embeddingConfig = buildConfig();
      const res = await fetch("/api/v1/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddingConfig: embeddingConfig ?? null }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast.success("Параметры векторизации сохранены");
      load();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl modal-glass overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Параметры векторизации (системный ключ)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Настройки чанкинга и поиска при использовании системного AI-провайдера.
        </p>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-foreground hover:text-primary"
        >
          Настроить
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Размер чанка (символов)</label>
              <Input
                type="number"
                min={100}
                max={2000}
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                placeholder="500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Перекрытие чанков</label>
              <Input
                type="number"
                min={0}
                max={200}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(e.target.value)}
                placeholder="50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Dimensions (256–3072, пусто = по умолчанию)
              </label>
              <Input
                type="number"
                min={256}
                max={3072}
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
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
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(e.target.value)}
                placeholder="0.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Чанков в контексте (topK)</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={topK}
                onChange={(e) => setTopK(e.target.value)}
                placeholder="10"
              />
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        )}
      </CardContent>
    </div>
  );
}
