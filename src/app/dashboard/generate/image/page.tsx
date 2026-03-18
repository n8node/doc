"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ImageIcon, ArrowRight, AlertCircle, Sparkles, Upload, X, Coins } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getModelFieldsConfig } from "@/lib/generation/model-fields-config";

/* TODO: вернуть выбор исходного изображения из «Мои файлы» (подгрузка с диска).
   См. .cursor/rules/generation-image-todo.mdc */

const PENDING_GEN_STORAGE_KEY = "dropbox-ru-image-gen-pending";

interface PendingGenState {
  taskId: string;
  status: string;
  prompt: string;
  selectedTaskId: string;
  selectedModelId: string;
  size: string;
  aspectRatio: string;
  fileIds: string[];
  resolution?: string;
  quality?: string;
  outputFormat?: string;
  strength?: number;
  negativePrompt?: string;
  seed?: number;
  numImages?: number;
  acceleration?: string;
  fluxModel?: string;
}

interface TaskItem {
  id: string;
  label: string;
}

interface ModelItem {
  id: string;
  name: string;
  description?: string;
}

export default function GenerateImagePage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [fileIds, setFileIds] = useState<string[]>([]);
  /** Превью загруженных файлов: fileId → object URL (для отображения и revoke). */
  const [uploadPreviews, setUploadPreviews] = useState<Array<{ fileId: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<string>("1:1");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>("1K");
  const [quality, setQuality] = useState<string>("medium");
  const [outputFormat, setOutputFormat] = useState<string>("png");
  const [strength, setStrength] = useState<number>(0.8);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | "">("");
  const [numImages, setNumImages] = useState<number>(1);
  const [acceleration, setAcceleration] = useState<string>("none");
  const [fluxModel, setFluxModel] = useState<string>("flux-kontext-pro");
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [costCredits, setCostCredits] = useState<number | null>(null);
  const [billedCredits, setBilledCredits] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Последние 4 генерации (новая справа, левая вытесняется). Хранятся на сервере, при загрузке подтягиваются. */
  const [recentGenerations, setRecentGenerations] = useState<Array<{ resultUrl: string; fileId?: string | null }>>([]);
  /** URL картинки для модалки в полный размер (null = модалка закрыта). */
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  const loadRecentGenerations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/generate/image/recent");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) return;
      const mapped = (data.items as { fileId: string; url: string }[]).map((i) => ({
        resultUrl: i.url,
        fileId: i.fileId,
      }));
      setRecentGenerations(mapped.reverse());
    } catch {
      // ignore
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/v1/generate/image/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setTasks(data.tasks ?? []);
      if ((data.tasks ?? []).length > 0 && !selectedTaskId) {
        setSelectedTaskId(data.tasks[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить задачи");
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    loadRecentGenerations();
  }, [loadRecentGenerations]);

  useEffect(() => {
    if (!selectedTaskId) {
      setModels([]);
      setSelectedModelId("");
      return;
    }
    setLoadingModels(true);
    fetch(`/api/v1/generate/image/models?taskId=${encodeURIComponent(selectedTaskId)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.models ?? [];
        setModels(list);
        setSelectedModelId((prev) => {
          if (prev && list.some((m: ModelItem) => m.id === prev)) return prev;
          return list[0]?.id ?? "";
        });
      })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [selectedTaskId]);

  // При смене модели подставляем допустимое значение соотношения/размера и разрешения
  useEffect(() => {
    if (!selectedModelId) return;
    const cfg = getModelFieldsConfig(selectedModelId);
    if (cfg.sizeOptions && !cfg.sizeOptions.some((o) => o.value === size)) {
      setSize(cfg.sizeOptions[0]?.value ?? "1:1");
    }
    if (cfg.aspectOptions && !cfg.aspectOptions.some((o) => o.value === aspectRatio)) {
      setAspectRatio(cfg.aspectOptions[0]?.value ?? "1:1");
    }
    // Flux2 только 1K/2K; при переключении с Nano (4K) сбрасываем на 2K
    if (cfg.showResolution && resolution === "4K" && selectedModelId !== "kie-nano-banana-pro" && selectedModelId !== "kie-nano-banana-2") {
      setResolution("2K");
    }
  }, [selectedModelId, size, aspectRatio, resolution]);

  // Выбор из «Мои файлы» временно отключён — только загрузка с компьютера. См. generation-image-todo.mdc
  useEffect(() => {
    if (selectedTaskId !== "edit_image" && selectedTaskId !== "variations") {
      setFileIds([]);
      setUploadPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
    }
  }, [selectedTaskId]);

  // При смене модели обрезаем список фото до лимита новой модели
  useEffect(() => {
    if (!selectedModelId || fileIds.length === 0) return;
    const cfg = getModelFieldsConfig(selectedModelId);
    const max = cfg.maxInputImages ?? 1;
    if (fileIds.length <= max) return;
    const keep = fileIds.slice(0, max);
    setFileIds(keep);
    setUploadPreviews((prev) => {
      const keepSet = new Set(keep);
      prev.forEach((p) => {
        if (!keepSet.has(p.fileId)) URL.revokeObjectURL(p.url);
      });
      return prev.filter((p) => keepSet.has(p.fileId));
    });
  }, [selectedModelId, fileIds.length]);

  const clearPendingStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(PENDING_GEN_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const pollStatus = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/generate/image/status?taskId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setStatus(data.status);
      if (data.resultUrl) setResultUrl(data.resultUrl);
      if (data.fileId) setFileId(data.fileId);
      if (data.costCredits != null) setCostCredits(data.costCredits);
      if (data.billedCredits != null) setBilledCredits(data.billedCredits);
      if (data.errorMessage) setErrorMessage(data.errorMessage);
      if (data.status === "success" && data.resultUrl) {
        setRecentGenerations((prev) => [...prev.slice(-3), { resultUrl: data.resultUrl!, fileId: data.fileId ?? null }].slice(-4));
      }
      if (data.status === "success" || data.status === "failed") {
        clearPendingStorage();
      }
      return data.status;
    },
    [clearPendingStorage]
  );

  useEffect(() => {
    if (!taskId || status === "success" || status === "failed") return;
    const t = setInterval(async () => {
      try {
        const s = await pollStatus(taskId);
        if (s === "success" || s === "failed") clearInterval(t);
      } catch {
        clearInterval(t);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [taskId, status, pollStatus]);

  // Восстановление незавершённой генерации при возврате на страницу
  const restoreChecked = useRef(false);
  useEffect(() => {
    if (restoreChecked.current) return;
    restoreChecked.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(PENDING_GEN_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let saved: PendingGenState;
    try {
      saved = JSON.parse(raw) as PendingGenState;
    } catch {
      return;
    }
    if (!saved?.taskId) return;
    fetch(`/api/v1/generate/image/status?taskId=${encodeURIComponent(saved.taskId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const s = data.status as string | undefined;
        setPrompt(saved.prompt ?? "");
        setSelectedTaskId(saved.selectedTaskId ?? "");
        setSelectedModelId(saved.selectedModelId ?? "");
        setSize(saved.size ?? "1:1");
        setAspectRatio(saved.aspectRatio ?? "16:9");
        setFileIds(Array.isArray(saved.fileIds) ? saved.fileIds : []);
        if (saved.resolution) setResolution(saved.resolution);
        if (saved.quality) setQuality(saved.quality);
        if (saved.outputFormat) setOutputFormat(saved.outputFormat);
        if (saved.strength != null) setStrength(saved.strength);
        if (saved.negativePrompt != null) setNegativePrompt(saved.negativePrompt);
        if (saved.seed != null) setSeed(saved.seed);
        if (saved.numImages != null) setNumImages(saved.numImages);
        if (saved.acceleration) setAcceleration(saved.acceleration);
        if (saved.fluxModel) setFluxModel(saved.fluxModel);
        setTaskId(saved.taskId);
        setStatus(s ?? null);
        if (s === "success") {
          if (data.resultUrl) setResultUrl(data.resultUrl);
          if (data.fileId) setFileId(data.fileId);
          if (data.costCredits != null) setCostCredits(data.costCredits);
          if (data.billedCredits != null) setBilledCredits(data.billedCredits);
          if (data.resultUrl) {
            setRecentGenerations((prev) => [...prev.slice(-3), { resultUrl: data.resultUrl, fileId: data.fileId ?? null }].slice(-4));
          }
          clearPendingStorage();
        } else if (s === "failed") {
          if (data.errorMessage) setErrorMessage(data.errorMessage);
          clearPendingStorage();
        }
      })
      .catch(() => {});
  }, [clearPendingStorage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !selectedModelId) {
      toast.error("Выберите задачу и модель");
      return;
    }
    if (!prompt.trim() && (selectedTaskId === "text_to_image" || fileIds.length === 0)) {
      toast.error("Введите промпт или выберите изображение");
      return;
    }
    if ((selectedTaskId === "edit_image" || selectedTaskId === "variations") && fileIds.length === 0) {
      toast.error("Выберите исходное изображение");
      return;
    }
    setSubmitting(true);
    setStatus("processing");
    setResultUrl(null);
    setFileId(null);
    setCostCredits(null);
    setBilledCredits(null);
    setErrorMessage(null);
    try {
      const cfg = getModelFieldsConfig(selectedModelId);
      const body: Record<string, unknown> = {
        taskType: selectedTaskId,
        modelId: selectedModelId,
        prompt: prompt.trim() || undefined,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        size: cfg.sizeOptions ? size : undefined,
        aspectRatio: cfg.aspectOptions ? aspectRatio : undefined,
        outputFormat: cfg.showOutputFormat !== false ? outputFormat : undefined,
        resolution: cfg.showResolution ? resolution : undefined,
        quality: cfg.showQuality ? quality : undefined,
        strength: cfg.showStrength ? strength : undefined,
        negativePrompt: cfg.showNegativePrompt && negativePrompt.trim() ? negativePrompt.trim() : undefined,
        seed: (cfg.showSeed && seed !== "") ? Number(seed) : undefined,
        numImages: cfg.showNumImages ? numImages : undefined,
        acceleration: cfg.showAcceleration ? acceleration : undefined,
        fluxModel: cfg.showFluxModel ? fluxModel : undefined,
      };
      const res = await fetch("/api/v1/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка запуска");
      setTaskId(data.taskId);
      const nextStatus = data.status ?? "processing";
      setStatus(nextStatus);
      try {
        const pending: PendingGenState = {
          taskId: data.taskId,
          status: nextStatus,
          prompt,
          selectedTaskId,
          selectedModelId,
          size,
          aspectRatio,
          fileIds: [...fileIds],
          resolution,
          quality,
          outputFormat,
          strength,
          negativePrompt: negativePrompt || undefined,
          seed: seed !== "" ? seed : undefined,
          numImages,
          acceleration,
          fluxModel,
        };
        window.localStorage.setItem(PENDING_GEN_STORAGE_KEY, JSON.stringify(pending));
      } catch {
        // ignore
      }
      if (data.status === "queued" && data.message) {
        toast.info(data.message);
      } else {
        toast.success("Генерация запущена");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setStatus(null);
      setTaskId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFromComputer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const cfg = getModelFieldsConfig(selectedModelId);
    const max = cfg.maxInputImages ?? 1;
    const canAdd = Math.max(0, max - fileIds.length);
    if (canAdd === 0) {
      toast.error(`Максимум ${max} изображений для этой модели`);
      e.target.value = "";
      return;
    }
    const toUpload = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, canAdd);
    if (!toUpload.length) {
      toast.error("Выберите файлы изображений");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const newIds: string[] = [];
    const newPreviews: Array<{ fileId: string; url: string }> = [];
    try {
      for (const file of toUpload) {
        const initRes = await fetch("/api/v1/files/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, mimeType: file.type, folderId: null }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.error ?? "Ошибка инициализации загрузки");
        const { uploadUrl, uploadHeaders, uploadSessionToken } = initData;
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": uploadHeaders?.["Content-Type"] ?? file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Ошибка загрузки файла");
        const completeRes = await fetch("/api/v1/files/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadSessionToken }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeData.error ?? "Ошибка завершения загрузки");
        const id = completeData.id;
        newIds.push(id);
        newPreviews.push({ fileId: id, url: URL.createObjectURL(file) });
      }
      setFileIds((prev) => [...prev, ...newIds]);
      setUploadPreviews((prev) => [...prev, ...newPreviews]);
      toast.success(toUpload.length === 1 ? "Файл загружен" : `Загружено ${toUpload.length} файлов`);
    } catch (err) {
      newPreviews.forEach((p) => URL.revokeObjectURL(p.url));
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveUploadedImage = (fileIdToRemove?: string) => {
    if (fileIdToRemove != null) {
      setFileIds((prev) => prev.filter((id) => id !== fileIdToRemove));
      setUploadPreviews((prev) => {
        const p = prev.find((x) => x.fileId === fileIdToRemove);
        if (p) URL.revokeObjectURL(p.url);
        return prev.filter((x) => x.fileId !== fileIdToRemove);
      });
    } else {
      setFileIds([]);
      setUploadPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    setPrompt("");
    handleRemoveUploadedImage();
    setSize("1:1");
    setAspectRatio("16:9");
    setResolution("1K");
    setQuality("medium");
    setOutputFormat("png");
    setStrength(0.8);
    setNegativePrompt("");
    setSeed("");
    setNumImages(1);
    setAcceleration("none");
    setFluxModel("flux-kontext-pro");
    setStatus(null);
    setTaskId(null);
    setResultUrl(null);
    setFileId(null);
    setCostCredits(null);
    setBilledCredits(null);
    setErrorMessage(null);
    clearPendingStorage();
  };

  if (tasks.length === 0 && !loadingTasks) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-medium">Генерация изображений недоступна</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Включите опцию «Генерация изображений» в тарифе или обратитесь к администратору.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ImageIcon className="h-7 w-7" />
          Генерация изображений
        </h1>
        <p className="text-muted-foreground mt-1">
          Выберите задачу и модель, введите промпт. Результат автоматически сохранится в «Мои файлы».
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Левая колонка: настройки (~38% ширины), правая — весь остаток */}
        <form onSubmit={handleSubmit} className="flex-[0_0_38%] min-w-[320px] max-w-[520px] space-y-4">
          {/* Сегментированный выбор задачи */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Задача</label>
            {loadingTasks ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            ) : (
              <div className="inline-flex rounded-lg border border-input bg-muted/30 p-0.5">
                {tasks.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedTaskId === t.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    } ${i === 0 ? "rounded-l-md" : ""} ${i === tasks.length - 1 ? "rounded-r-md" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Модели — теги со скруглением, перенос на новую строку в пределах левой колонки */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Модель</label>
            {loadingModels ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelId(m.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors border ${
                      selectedModelId === m.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Блок «Ввод»: промпт, загрузка, модель-специфичные поля */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ввод</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1">Промпт</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите изображение или правки на английском или русском"
                  rows={4}
                  className="resize-none rounded-lg border-input mt-1"
                />
              </div>
              {(selectedTaskId === "edit_image" || selectedTaskId === "variations") && (
                <div>
                  <Label className="mb-1">
                    Исходные изображения (загрузка с компьютера)
                    {selectedModelId && (() => {
                      const max = getModelFieldsConfig(selectedModelId).maxInputImages ?? 1;
                      return max > 1 ? ` — до ${max} фото` : null;
                    })()}
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadFromComputer}
                    className="hidden"
                  />
                  {uploadPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {uploadPreviews.map((p) => (
                        <div key={p.fileId} className="relative rounded-lg border overflow-hidden bg-muted/30">
                          <img src={p.url} alt="" className="h-20 w-20 object-cover" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-0.5 right-0.5 h-6 w-6"
                            onClick={() => handleRemoveUploadedImage(p.fileId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || (() => {
                        const max = getModelFieldsConfig(selectedModelId).maxInputImages ?? 1;
                        return fileIds.length >= max;
                      })()}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading ? "Загрузка…" : uploadPreviews.length === 0 ? "Выбрать файл(ы)" : `Добавить ещё (${fileIds.length}/${getModelFieldsConfig(selectedModelId).maxInputImages ?? 1})`}
                    </Button>
                    {uploadPreviews.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveUploadedImage()}>
                        Удалить все
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {selectedModelId && (() => {
                const cfg = getModelFieldsConfig(selectedModelId);
                return (
                  <>
                    {cfg.sizeOptions && (
                      <div>
                        <Label className="mb-1">Соотношение сторон</Label>
                        <select
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          {cfg.sizeOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {cfg.aspectOptions && (
                      <div>
                        <Label className="mb-1">Соотношение сторон</Label>
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          {cfg.aspectOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {cfg.showResolution && (
                      <div>
                        <Label className="mb-1">Разрешение</Label>
                        <div className="flex gap-2 mt-1">
                          {(selectedModelId === "kie-nano-banana-pro" || selectedModelId === "kie-nano-banana-2"
                            ? (["1K", "2K", "4K"] as const)
                            : (["1K", "2K"] as const)
                          ).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setResolution(r)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                resolution === r ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background hover:bg-muted/50"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {cfg.showQuality && (
                      <div>
                        <Label className="mb-1">Качество</Label>
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          <option value="medium">Среднее (быстрее)</option>
                          <option value="high">Высокое (детальнее)</option>
                        </select>
                      </div>
                    )}
                    {cfg.showOutputFormat && (
                      <div>
                        <Label className="mb-1">Формат вывода</Label>
                        <div className="flex gap-2 mt-1">
                          {(["png", "jpeg"] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setOutputFormat(f)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                outputFormat === f ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background hover:bg-muted/50"
                              }`}
                            >
                              {f.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {cfg.showStrength && (
                      <div>
                        <Label className="mb-1">Сила изменения (strength): {strength.toFixed(1)} — 1.0 = перерисовать, 0.0 = сохранить оригинал</Label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.1}
                          value={strength}
                          onChange={(e) => setStrength(parseFloat(e.target.value))}
                          className="w-full mt-1"
                        />
                      </div>
                    )}
                    {cfg.showNegativePrompt && (
                      <div>
                        <Label className="mb-1">Негативный промпт (чего избегать)</Label>
                        <Input
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder="напр. blurry, ugly"
                          className="mt-1"
                        />
                      </div>
                    )}
                    {cfg.showSeed && (
                      <div>
                        <Label className="mb-1">Seed (для воспроизводимости, опционально)</Label>
                        <Input
                          type="number"
                          value={seed === "" ? "" : seed}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSeed(v === "" ? "" : parseInt(v, 10) || 0);
                          }}
                          placeholder="пусто = случайный"
                          className="mt-1"
                        />
                      </div>
                    )}
                    {cfg.showNumImages && (
                      <div>
                        <Label className="mb-1">Количество изображений</Label>
                        <select
                          value={numImages}
                          onChange={(e) => setNumImages(parseInt(e.target.value, 10))}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {cfg.showAcceleration && (
                      <div>
                        <Label className="mb-1">Ускорение</Label>
                        <select
                          value={acceleration}
                          onChange={(e) => setAcceleration(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          <option value="none">Нет</option>
                          <option value="regular">Regular (баланс)</option>
                          <option value="high">High (быстрее, без текста)</option>
                        </select>
                      </div>
                    )}
                    {cfg.showFluxModel && (
                      <div>
                        <Label className="mb-1">Вариант Flux Kontext</Label>
                        <select
                          value={fluxModel}
                          onChange={(e) => setFluxModel(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          <option value="flux-kontext-pro">Pro</option>
                          <option value="flux-kontext-max">Max</option>
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <div className="flex gap-2 items-center justify-between w-full flex-wrap">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleReset}>
                Сбросить
              </Button>
              <Button type="submit" disabled={submitting || !selectedTaskId || !selectedModelId}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Сгенерировать
              </Button>
            </div>
            {(billedCredits != null || costCredits != null) && (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span>{billedCredits ?? costCredits ?? 0} кредитов</span>
              </div>
            )}
          </div>
        </form>

        {/* Область результата и последние 4 генерации */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 max-w-[520px]">
          <div
            className="min-h-[420px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center p-6"
          >
            {!status && (
              <p className="text-muted-foreground text-center text-sm">
                Здесь появится результат генерации
              </p>
            )}
            {status === "queued" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Задача в очереди. Скоро начнётся генерация, результат сохранится в «Мои файлы».</p>
              </div>
            )}
            {status === "processing" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Генерация занимает до минуты. Результат сохранится в «Мои файлы».</p>
              </div>
            )}
            {status === "failed" && (
              <div className="flex flex-col items-center gap-2 text-center text-destructive">
                <AlertCircle className="h-10 w-10 shrink-0" />
                <p className="text-sm font-medium">{errorMessage ?? "Ошибка генерации"}</p>
              </div>
            )}
            {status === "success" && (resultUrl || fileId) && (
              <div className="w-full max-w-2xl space-y-4 flex flex-col items-center">
                {resultUrl && (
                  <button
                    type="button"
                    onClick={() => setImageModalUrl(resultUrl)}
                    className="block w-full focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  >
                    <img src={resultUrl} alt="Результат" className="max-w-full rounded-lg border object-contain max-h-[70vh] cursor-pointer" />
                  </button>
                )}
                {fileId && (
                  <Link href="/dashboard/files?section=my-files">
                    <Button variant="outline" size="sm">
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Открыть в «Мои файлы»
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
          {/* 4 последние генерации: новая справа, левая вытесняется */}
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => {
              const item = recentGenerations[i];
              return (
                <div
                  key={i}
                  className="flex-1 min-w-0 aspect-square max-h-24 rounded-lg border border-muted-foreground/20 bg-muted/30 overflow-hidden flex items-center justify-center"
                >
                  {item ? (
                    <button
                      type="button"
                      onClick={() => setImageModalUrl(item.resultUrl)}
                      className="w-full h-full focus:outline-none focus:ring-2 focus:ring-primary rounded"
                    >
                      <img
                        src={item.resultUrl}
                        alt=""
                        className="w-full h-full object-cover cursor-pointer"
                      />
                    </button>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!imageModalUrl} onOpenChange={(open) => !open && setImageModalUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2 border-0 bg-transparent shadow-none">
          {imageModalUrl && (
            <img
              src={imageModalUrl}
              alt="Увеличенное изображение"
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
