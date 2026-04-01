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
  chatTokensQuota?: number | null;
  searchTokensQuota?: number | null;
  aiAnalysisDocumentsQuota?: number | null;
  ragDocumentsQuota?: number | null;
  webImportPagesQuota?: number | null;
  imageGenerationCreditsQuota?: number | null;
  videoGenerationCreditsQuota?: number | null;
  freePlanDurationDays?: number | null;
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
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

const featureLabels: Record<string, string> = {
  video_player: "Видеоплеер",
  audio_player: "Аудиоплеер",
  share_links: "Ссылки для шаринга",
  folder_share: "Шаринг папок",
  shared_access_email: "Совместный доступ",
  ai_search: "AI-поиск",
  document_chat: "AI чаты по документам",
  document_analysis: "AI-анализ документов",
  rag_memory: "RAG-память",
  n8n_connection: "Подключение к n8n",
  sheets: "Таблицы",
  web_import: "Парсинг сайтов",
  transcription_audio: "Транскрибация аудио",
  transcription_video: "Транскрибация видео",
  own_ai_keys: "Свой API-ключ для AI (токены не списываются)",
  content_generation: "Генерация изображений",
  video_generation: "Генерация видео (Kling)",
  calendar_bridge: "Мост календаря (Яндекс → API / n8n)",
  mail_bridge: "Мост почты (IMAP/SMTP, Яндекс → API / n8n)",
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
    shared_access_email: false,
    ai_search: false,
    document_chat: false,
    document_analysis: false,
    rag_memory: false,
    n8n_connection: false,
    sheets: false,
    web_import: false,
    transcription_audio: false,
    transcription_video: false,
    own_ai_keys: false,
    content_generation: false,
    video_generation: false,
    calendar_bridge: false,
    mail_bridge: false,
  });
  const [trashDays, setTrashDays] = useState("0");
  const [aiAnalysisDocumentsQuota, setAiAnalysisDocumentsQuota] = useState("");
  const [ragDocumentsQuota, setRagDocumentsQuota] = useState("");
  const [webImportPagesQuota, setWebImportPagesQuota] = useState("");
  const [freePlanDurationDays, setFreePlanDurationDays] = useState("");
  const [embeddingTokensQuota, setEmbeddingTokensQuota] = useState("");
  const [chatTokensQuota, setChatTokensQuota] = useState("");
  const [searchTokensQuota, setSearchTokensQuota] = useState("");
  const [imageGenerationCreditsQuota, setImageGenerationCreditsQuota] = useState("");
  const [videoGenerationCreditsQuota, setVideoGenerationCreditsQuota] = useState("");
  const [transcriptionMinutesQuota, setTranscriptionMinutesQuota] = useState("");
  const [transcriptionAudioMinutesQuota, setTranscriptionAudioMinutesQuota] = useState("");
  const [transcriptionVideoMinutesQuota, setTranscriptionVideoMinutesQuota] = useState("");
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
      setChatTokensQuota(
        plan.chatTokensQuota != null ? String(plan.chatTokensQuota) : "",
      );
      setSearchTokensQuota(
        plan.searchTokensQuota != null ? String(plan.searchTokensQuota) : "",
      );
      setImageGenerationCreditsQuota(
        plan.imageGenerationCreditsQuota != null ? String(plan.imageGenerationCreditsQuota) : "",
      );
      setVideoGenerationCreditsQuota(
        plan.videoGenerationCreditsQuota != null ? String(plan.videoGenerationCreditsQuota) : "",
      );
      setAiAnalysisDocumentsQuota(
        plan.aiAnalysisDocumentsQuota != null ? String(plan.aiAnalysisDocumentsQuota) : "",
      );
      setRagDocumentsQuota(
        plan.ragDocumentsQuota != null ? String(plan.ragDocumentsQuota) : "",
      );
      setWebImportPagesQuota(
        plan.webImportPagesQuota != null ? String(plan.webImportPagesQuota) : "",
      );
      setFreePlanDurationDays(
        plan.freePlanDurationDays != null ? String(plan.freePlanDurationDays) : "",
      );
      setTranscriptionMinutesQuota(
        plan.transcriptionMinutesQuota != null ? String(plan.transcriptionMinutesQuota) : "",
      );
      setTranscriptionAudioMinutesQuota(
        plan.transcriptionAudioMinutesQuota != null ? String(plan.transcriptionAudioMinutesQuota) : "",
      );
      setTranscriptionVideoMinutesQuota(
        plan.transcriptionVideoMinutesQuota != null ? String(plan.transcriptionVideoMinutesQuota) : "",
      );
      setMaxTranscriptionVideoMinutes(
        String(plan.maxTranscriptionVideoMinutes ?? 60),
      );
      setMaxTranscriptionAudioMinutes(
        String(plan.maxTranscriptionAudioMinutes ?? 120),
      );
      setTranscriptionProviderId(plan.transcriptionProviderId ?? "");
      const raw = plan.features || {};
      const legacyOn = raw.transcription === true;
      setFeatures({
        ...raw,
        transcription_audio: raw.transcription_audio ?? legacyOn,
        transcription_video: raw.transcription_video ?? legacyOn,
        video_generation: raw.video_generation ?? false,
      });
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
      setChatTokensQuota("");
      setSearchTokensQuota("");
      setImageGenerationCreditsQuota("");
      setVideoGenerationCreditsQuota("");
      setAiAnalysisDocumentsQuota("");
      setRagDocumentsQuota("");
      setWebImportPagesQuota("");
      setFreePlanDurationDays("");
      setTranscriptionMinutesQuota("");
      setTranscriptionAudioMinutesQuota("");
      setTranscriptionVideoMinutesQuota("");
      setMaxTranscriptionVideoMinutes("60");
      setMaxTranscriptionAudioMinutes("120");
      setTranscriptionProviderId("");
      setFeatures({
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        shared_access_email: false,
        ai_search: false,
        document_chat: false,
        document_analysis: false,
        rag_memory: false,
        n8n_connection: false,
        sheets: false,
        web_import: false,
        transcription_audio: false,
        transcription_video: false,
        own_ai_keys: false,
        content_generation: false,
        video_generation: false,
        calendar_bridge: false,
        mail_bridge: false,
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
      chatTokensQuota: chatTokensQuota.trim()
        ? Math.max(0, parseInt(chatTokensQuota, 10) || 0) || null
        : null,
      searchTokensQuota: searchTokensQuota.trim()
        ? Math.max(0, parseInt(searchTokensQuota, 10) || 0) || null
        : null,
      imageGenerationCreditsQuota: imageGenerationCreditsQuota.trim()
        ? Math.max(0, parseInt(imageGenerationCreditsQuota, 10) || 0) || null
        : null,
      videoGenerationCreditsQuota: videoGenerationCreditsQuota.trim()
        ? Math.max(0, parseInt(videoGenerationCreditsQuota, 10) || 0) || null
        : null,
      aiAnalysisDocumentsQuota: aiAnalysisDocumentsQuota.trim()
        ? Math.max(0, parseInt(aiAnalysisDocumentsQuota, 10) || 0) || null
        : null,
      ragDocumentsQuota: ragDocumentsQuota.trim()
        ? Math.max(0, parseInt(ragDocumentsQuota, 10) || 0) || null
        : null,
      webImportPagesQuota: webImportPagesQuota.trim()
        ? Math.max(0, parseInt(webImportPagesQuota, 10) || 0) || null
        : null,
      freePlanDurationDays: freePlanDurationDays.trim()
        ? Math.max(1, parseInt(freePlanDurationDays, 10) || 1)
        : null,
      transcriptionMinutesQuota: transcriptionMinutesQuota.trim()
        ? Math.max(0, parseInt(transcriptionMinutesQuota, 10) || 0) || null
        : null,
      transcriptionAudioMinutesQuota: transcriptionAudioMinutesQuota.trim()
        ? Math.max(0, parseInt(transcriptionAudioMinutesQuota, 10) || 0) || null
        : null,
      transcriptionVideoMinutesQuota: transcriptionVideoMinutesQuota.trim()
        ? Math.max(0, parseInt(transcriptionVideoMinutesQuota, 10) || 0) || null
        : null,
      maxTranscriptionVideoMinutes: Math.max(1, parseInt(maxTranscriptionVideoMinutes, 10) || 60),
      maxTranscriptionAudioMinutes: Math.max(1, parseInt(maxTranscriptionAudioMinutes, 10) || 120),
      transcriptionProviderId: transcriptionProviderId.trim() || null,
      features: {
        ...features,
        transcription:
          !!(features.transcription_audio || features.transcription_video),
      },
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
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
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

          {/* Срок бесплатного тарифа */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Срок бесплатного тарифа (дней)
            </label>
            <Input
              type="number"
              min={1}
              value={freePlanDurationDays}
              onChange={(e) => setFreePlanDurationDays(e.target.value)}
              placeholder="Без ограничения"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Учитывается только для бесплатных тарифов. 1 день = 24 часа.
              Пусто — без ограничения.
            </p>
          </div>

          {/* Токены по категориям */}
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Квоты токенов по категориям</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Чат по документам / мес
                </label>
                <Input
                  type="number"
                  min={0}
                  value={chatTokensQuota}
                  onChange={(e) => setChatTokensQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Поиск / мес
                </label>
                <Input
                  type="number"
                  min={0}
                  value={searchTokensQuota}
                  onChange={(e) => setSearchTokensQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Кредитов на изображения / мес
                </label>
                <Input
                  type="number"
                  min={0}
                  value={imageGenerationCreditsQuota}
                  onChange={(e) => setImageGenerationCreditsQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Кредитов на видео / мес
                </label>
                <Input
                  type="number"
                  min={0}
                  value={videoGenerationCreditsQuota}
                  onChange={(e) => setVideoGenerationCreditsQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Эмбеддинг / мес
                </label>
                <Input
                  type="number"
                  min={0}
                  value={embeddingTokensQuota}
                  onChange={(e) => setEmbeddingTokensQuota(e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
            </div>
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

          {/* Парсинг сайтов */}
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">Парсинг сайтов</h4>
            <p className="text-xs text-muted-foreground">
              Включите в блоке «Функции» — «Парсинг сайтов». Квота — успешно обработанных страниц в месяц (UTC).
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Страниц в месяц (квота)
              </label>
              <Input
                type="number"
                min={0}
                value={webImportPagesQuota}
                onChange={(e) => setWebImportPagesQuota(e.target.value)}
                placeholder="Без лимита"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Пусто — без лимита по страницам (при включённой функции).
              </p>
            </div>
          </div>

          {/* RAG-память */}
          <div className="space-y-3 rounded-xl border border-border bg-surface2/30 p-4">
            <h4 className="text-sm font-medium">RAG-память</h4>
            <p className="text-xs text-muted-foreground">
              Функция включается в блоке «Функции» (чекбокс «RAG-память»). Квота — документов в коллекциях.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Документов в RAG-коллекциях (квота)
              </label>
              <Input
                type="number"
                min={0}
                value={ragDocumentsQuota}
                onChange={(e) => setRagDocumentsQuota(e.target.value)}
                placeholder="Без лимита"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Оставьте пустым для безлимита.
              </p>
            </div>
          </div>

          {/* Транскрибация: аудио и видео — отдельные виды; месячные квоты и лимит на файл */}
          <div className="space-y-4 rounded-xl border border-border bg-surface2/30 p-4">
            <div>
              <h4 className="text-sm font-medium">Транскрибация</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Два вида: <strong className="text-foreground">аудиофайлы</strong> и <strong className="text-foreground">видео</strong> (дорожка извлекается с видео). Пока оба поля «Мин/мес — только аудио/видео» пусты, действует
                общая месячная квота. Если заполнено хотя бы одно — учёт минут раздельный; пустое поле для типа
                подставляет общую квоту.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Минут в месяц (квоты)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Общая (если не заданы раздельно)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={transcriptionMinutesQuota}
                    onChange={(e) => setTranscriptionMinutesQuota(e.target.value)}
                    placeholder="Без лимита"
                  />
                </div>
                <div />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Только аудио
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={transcriptionAudioMinutesQuota}
                    onChange={(e) => setTranscriptionAudioMinutesQuota(e.target.value)}
                    placeholder="Как общая"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Только видео
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={transcriptionVideoMinutesQuota}
                    onChange={(e) => setTranscriptionVideoMinutesQuota(e.target.value)}
                    placeholder="Как общая"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Максимальная длительность одного файла</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Аудио (мин за файл)
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
                    Видео (мин за файл)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={maxTranscriptionVideoMinutes}
                    onChange={(e) => setMaxTranscriptionVideoMinutes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Премиум-провайдер
                </label>
                <select
                  value={transcriptionProviderId}
                  onChange={(e) => setTranscriptionProviderId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">QoQon (Whisper) по умолчанию</option>
                  {transcriptionProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name === "openrouter_transcription" ? "Транскрипт" : p.name}
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
