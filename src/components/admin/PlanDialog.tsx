"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface PlanData {
  id?: string;
  name: string;
  isFree: boolean;
  isPopular: boolean;
  storageQuota: number;
  maxFileSize: number;
  trashRetentionDays: number;
  embeddingTokensQuota: number | null;
  aiAnalysisDocumentsQuota?: number | null;
  transcriptionMinutesQuota?: number | null;
  maxTranscriptionVideoMinutes?: number;
  maxTranscriptionAudioMinutes?: number;
  transcriptionProviderId?: string | null;
  features: Record<string, boolean>;
  priceMonthly: number | null;
  priceYearly: number | null;
}

interface PlanDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan?: PlanData | null;
}

// REMINDER: Video transcription disabled. Restore "аудио/видео" when re-enabling.
const featureLabels: Record<string, string> = {
  video_player: "Видеоплеер",
  audio_player: "Аудиоплеер",
  share_links: "Ссылки для шаринга",
  folder_share: "Шаринг папок",
  ai_search: "AI-поиск",
  document_chat: "AI чаты по документам",
  document_analysis: "AI-анализ документов",
  transcription: "Транскрибация",
};

const bytesToGb = (bytes: number) => +(bytes / (1024 * 1024 * 1024)).toFixed(2);
const gbToBytes = (gb: number) => Math.round(gb * 1024 * 1024 * 1024);
const bytesToMb = (bytes: number) => +(bytes / (1024 * 1024)).toFixed(0);
const mbToBytes = (mb: number) => Math.round(mb * 1024 * 1024);

export function PlanDialog({ open, onClose, onSaved, plan }: PlanDialogProps) {
  const isEdit = !!plan?.id;

  const [name, setName] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [storageGb, setStorageGb] = useState("25");
  const [maxFileMb, setMaxFileMb] = useState("512");
  const [features, setFeatures] = useState<Record<string, boolean>>({
    video_player: true,
    audio_player: true,
    share_links: true,
    folder_share: true,
    ai_search: false,
    document_chat: false,
    document_analysis: false,
  });
  const [trashDays, setTrashDays] = useState("0");
  const [aiAnalysisDocumentsQuota, setAiAnalysisDocumentsQuota] = useState("");
  const [embeddingTokensQuota, setEmbeddingTokensQuota] = useState("");
  const [transcriptionMinutesQuota, setTranscriptionMinutesQuota] = useState("");
  const [maxTranscriptionVideoMinutes, setMaxTranscriptionVideoMinutes] = useState("60");
  const [maxTranscriptionAudioMinutes, setMaxTranscriptionAudioMinutes] = useState("120");
  const [transcriptionProviderId, setTranscriptionProviderId] = useState("");
  const [transcriptionProviders, setTranscriptionProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [priceMonthly, setPriceMonthly] = useState("");
  const [priceYearly, setPriceYearly] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTranscriptionProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai/providers");
      const data = await res.json();
      const list = (data.providers ?? []).filter((p: { purpose?: string }) => p.purpose === "TRANSCRIPTION");
      setTranscriptionProviders(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    } catch {
      setTranscriptionProviders([]);
    }
  }, []);

  useEffect(() => {
    if (open) loadTranscriptionProviders();
  }, [open, loadTranscriptionProviders]);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setIsFree(plan.isFree);
      setIsPopular(plan.isPopular ?? false);
      setStorageGb(String(bytesToGb(plan.storageQuota)));
      setMaxFileMb(String(bytesToMb(plan.maxFileSize)));
      setTrashDays(String(plan.trashRetentionDays ?? 0));
      setEmbeddingTokensQuota(
        plan.embeddingTokensQuota != null ? String(plan.embeddingTokensQuota) : "",
      );
      setAiAnalysisDocumentsQuota(
        plan.aiAnalysisDocumentsQuota != null ? String(plan.aiAnalysisDocumentsQuota) : "",
      );
      setTranscriptionMinutesQuota(
        plan.transcriptionMinutesQuota != null ? String(plan.transcriptionMinutesQuota) : "",
      );
      setMaxTranscriptionVideoMinutes(
        String(plan.maxTranscriptionVideoMinutes ?? 60),
      );
      setMaxTranscriptionAudioMinutes(
        String(plan.maxTranscriptionAudioMinutes ?? 120),
      );
      setTranscriptionProviderId(plan.transcriptionProviderId ?? "");
      setFeatures(plan.features || {});
      setPriceMonthly(plan.priceMonthly != null ? String(plan.priceMonthly) : "");
      setPriceYearly(plan.priceYearly != null ? String(plan.priceYearly) : "");
    } else {
      setName("");
      setIsFree(false);
      setIsPopular(false);
      setStorageGb("25");
      setMaxFileMb("512");
      setTrashDays("0");
      setEmbeddingTokensQuota("");
      setAiAnalysisDocumentsQuota("");
      setTranscriptionMinutesQuota("");
      setMaxTranscriptionVideoMinutes("60");
      setMaxTranscriptionAudioMinutes("120");
      setTranscriptionProviderId("");
      setFeatures({
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        ai_search: false,
        document_chat: false,
        document_analysis: false,
        transcription: false,
      });
      setPriceMonthly("");
      setPriceYearly("");
    }
  }, [plan, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Введите название");
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      isFree,
      isPopular,
      storageQuota: gbToBytes(parseFloat(storageGb) || 25),
      maxFileSize: mbToBytes(parseFloat(maxFileMb) || 512),
      trashRetentionDays: parseInt(trashDays, 10) || 0,
      embeddingTokensQuota: embeddingTokensQuota.trim()
        ? Math.max(0, parseInt(embeddingTokensQuota, 10) || 0) || null
        : null,
      aiAnalysisDocumentsQuota: aiAnalysisDocumentsQuota.trim()
        ? Math.max(0, parseInt(aiAnalysisDocumentsQuota, 10) || 0) || null
        : null,
      transcriptionMinutesQuota: transcriptionMinutesQuota.trim()
        ? Math.max(0, parseInt(transcriptionMinutesQuota, 10) || 0) || null
        : null,
      maxTranscriptionVideoMinutes: Math.max(1, parseInt(maxTranscriptionVideoMinutes, 10) || 60),
      maxTranscriptionAudioMinutes: Math.max(1, parseInt(maxTranscriptionAudioMinutes, 10) || 120),
      transcriptionProviderId: transcriptionProviderId.trim() || null,
      features,
      priceMonthly: priceMonthly ? parseInt(priceMonthly, 10) : null,
      priceYearly: priceYearly ? parseInt(priceYearly, 10) : null,
    };

    try {
      const url = isEdit ? `/api/v1/admin/plans/${plan!.id}` : "/api/v1/admin/plans";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(isEdit ? "Тариф обновлён" : "Тариф создан");
        onSaved();
        onClose();
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать тариф" : "Новый тариф"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Название */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Название</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Стандарт"
            />
          </div>

          {/* Флаги */}
          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">Бесплатный тариф</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPopular}
                onChange={(e) => setIsPopular(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">Популярный</span>
              <span className="text-xs text-muted-foreground">(снимется с других тарифов)</span>
            </label>
          </div>

          {/* Квота и лимит */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Квота хранилища (ГБ)</label>
              <Input
                type="number"
                min={1}
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Макс. файл (МБ)</label>
              <Input
                type="number"
                min={1}
                max={5120}
                value={maxFileMb}
                onChange={(e) => setMaxFileMb(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Максимум: 5120 МБ (5 ГБ)</p>
            </div>
          </div>

          {/* Корзина */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Корзина (дней хранения)</label>
            <Input
              type="number"
              min={0}
              max={365}
              value={trashDays}
              onChange={(e) => setTrashDays(e.target.value)}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              0 = без корзины (удаление сразу). Платные тарифы обычно 30 дней.
            </p>
          </div>

          {/* Токены на анализ */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Токенов на анализ документов в месяц
            </label>
            <Input
              type="number"
              min={0}
              value={embeddingTokensQuota}
              onChange={(e) => setEmbeddingTokensQuota(e.target.value)}
              placeholder="Без лимита"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Оставьте пустым для безлимита. Учитываются токены при эмбеддинге (AI-анализ).
            </p>
          </div>

          {/* AI-анализ документов */}
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">AI-анализ документов</h4>
            <p className="text-xs text-muted-foreground">
              Функция включается в блоке «Функции» (чекбокс «AI-анализ документов»). Квота — документов в месяц.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Документов в месяц (квота)
              </label>
              <Input
                type="number"
                min={0}
                value={aiAnalysisDocumentsQuota}
                onChange={(e) => setAiAnalysisDocumentsQuota(e.target.value)}
                placeholder="Без лимита"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Оставьте пустым для безлимита.
              </p>
            </div>
          </div>

          {/* Транскрибация — REMINDER: video fields commented, restore when video transcription enabled */}
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Транскрибация</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Минут в месяц (квота)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={transcriptionMinutesQuota}
                  onChange={(e) => setTranscriptionMinutesQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
              {/* REMINDER: Video max minutes — uncomment when video transcription restored
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Макс. видео (мин)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxTranscriptionVideoMinutes}
                  onChange={(e) => setMaxTranscriptionVideoMinutes(e.target.value)}
                />
              </div>
              */}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Макс. аудио (мин)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxTranscriptionAudioMinutes}
                  onChange={(e) => setMaxTranscriptionAudioMinutes(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Премиум-провайдер
                </label>
                <select
                  value={transcriptionProviderId}
                  onChange={(e) => setTranscriptionProviderId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Docling (Whisper) по умолчанию</option>
                  {transcriptionProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Цены */}
          {!isFree && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Цена/мес (₽)</label>
                <Input
                  type="number"
                  min={0}
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(e.target.value)}
                  placeholder="299"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Цена/год (₽)</label>
                <Input
                  type="number"
                  min={0}
                  value={priceYearly}
                  onChange={(e) => setPriceYearly(e.target.value)}
                  placeholder="2990"
                />
              </div>
            </div>
          )}

          {/* Функции */}
          <div>
            <label className="mb-2 block text-sm font-medium">Функции</label>
            <div className="space-y-2 rounded-xl border border-border bg-surface2/30 p-4">
              {Object.entries(featureLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!features[key]}
                    onChange={(e) =>
                      setFeatures((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : isEdit ? (
                "Сохранить"
              ) : (
                "Создать"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
