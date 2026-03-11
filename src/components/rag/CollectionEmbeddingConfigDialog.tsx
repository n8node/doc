"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EmbeddingConfigInput {
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number | null;
  similarityThreshold?: number;
  topK?: number;
}

interface CollectionEmbeddingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  collectionName: string;
  embeddingConfig: EmbeddingConfigInput | null;
  onSaved: () => void;
}

export function CollectionEmbeddingConfigDialog({
  open,
  onOpenChange,
  collectionId,
  collectionName,
  embeddingConfig,
  onSaved,
}: CollectionEmbeddingConfigDialogProps) {
  const [chunkSize, setChunkSize] = useState("");
  const [chunkOverlap, setChunkOverlap] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [similarityThreshold, setSimilarityThreshold] = useState("");
  const [topK, setTopK] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const ec = embeddingConfig as Record<string, unknown> | null;
      setChunkSize(ec?.chunkSize != null ? String(ec.chunkSize) : "");
      setChunkOverlap(ec?.chunkOverlap != null ? String(ec.chunkOverlap) : "");
      setDimensions(ec?.dimensions != null ? String(ec.dimensions) : "");
      setSimilarityThreshold(ec?.similarityThreshold != null ? String(ec.similarityThreshold) : "");
      setTopK(ec?.topK != null ? String(ec.topK) : "");
    }
  }, [open, embeddingConfig]);

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
      const config = buildConfig();
      const res = await fetch(`/api/v1/rag/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddingConfig: config }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка сохранения");
      }
      toast.success("Настройки векторизации сохранены");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Настроить векторизацию — {collectionName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Параметры применяются при следующей векторизации этой коллекции. Пустые поля — значения по умолчанию.
        </p>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Размер чанка (символов)</Label>
            <Input
              type="number"
              min={100}
              max={2000}
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              placeholder="500"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Перекрытие чанков</Label>
            <Input
              type="number"
              min={0}
              max={200}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(e.target.value)}
              placeholder="50"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Dimensions (OpenAI, 256–3072)</Label>
            <Input
              type="number"
              min={256}
              max={3072}
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="по умолчанию модели"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Порог схожести (0.3–0.95)</Label>
            <Input
              type="number"
              min={0.3}
              max={0.95}
              step={0.05}
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(e.target.value)}
              placeholder="0.5"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Число чанков в контексте (topK)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              placeholder="10"
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
