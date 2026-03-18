"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ImageIcon, ArrowRight, AlertCircle, Sparkles, Upload, X, Coins } from "lucide-react";
import { toast } from "sonner";

/* TODO: вернуть выбор исходного изображения из «Мои файлы» (подгрузка с диска).
   См. .cursor/rules/generation-image-todo.mdc */

const PENDING_GEN_STORAGE_KEY = "dropbox-ru-image-gen-pending";

interface PendingGenState {
  taskId: string;
  status: string;
  prompt: string;
  selectedTaskId: string;
  selectedModelId: string;
  size: "1:1" | "3:2" | "2:3";
  aspectRatio: string;
  fileIds: string[];
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
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<"1:1" | "3:2" | "2:3">("1:1");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [costCredits, setCostCredits] = useState<number | null>(null);
  const [billedCredits, setBilledCredits] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Последние 4 генерации (новая справа, левая вытесняется). */
  const [recentGenerations, setRecentGenerations] = useState<Array<{ resultUrl: string; fileId?: string | null }>>([]);

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

  // Выбор из «Мои файлы» временно отключён — только загрузка с компьютера. См. generation-image-todo.mdc
  useEffect(() => {
    if (selectedTaskId !== "edit_image" && selectedTaskId !== "variations") {
      setFileIds([]);
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
  }, [selectedTaskId]);

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
      const body: Record<string, unknown> = {
        taskType: selectedTaskId,
        modelId: selectedModelId,
        prompt: prompt.trim() || undefined,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        size: selectedModelId === "kie-4o-image" ? size : undefined,
        aspectRatio: aspectRatio || undefined,
        outputFormat: "png",
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
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Выберите файл изображения");
      return;
    }
    setUploading(true);
    try {
      const initRes = await fetch("/api/v1/files/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          mimeType: file.type,
          folderId: null,
        }),
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
      setFileIds([id]);
      setUploadPreviewUrl(URL.createObjectURL(file));
      toast.success("Файл загружен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveUploadedImage = () => {
    setFileIds([]);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleReset = () => {
    setPrompt("");
    handleRemoveUploadedImage();
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

          {/* Один блок «Ввод»: промпт, загрузка с компьютера, соотношение сторон */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ввод</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Промпт</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите изображение или правки на английском или русском"
                  rows={4}
                  className="resize-none rounded-lg border-input"
                />
              </div>
              {(selectedTaskId === "edit_image" || selectedTaskId === "variations") && (
                <div>
                  <label className="block text-sm font-medium mb-1">Исходное изображение (загрузка с компьютера)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFromComputer}
                    className="hidden"
                  />
                  {!uploadPreviewUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading ? "Загрузка…" : "Выбрать файл"}
                    </Button>
                  ) : (
                    <div className="relative rounded-lg border overflow-hidden inline-block">
                      <img src={uploadPreviewUrl} alt="Превью" className="max-h-32 object-contain" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={handleRemoveUploadedImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Соотношение сторон</label>
                {selectedModelId === "kie-4o-image" ? (
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value as "1:1" | "3:2" | "2:3")}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1:1">1:1</option>
                    <option value="3:2">3:2</option>
                    <option value="2:3">2:3</option>
                  </select>
                ) : (
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="21:9">21:9</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1</option>
                    <option value="3:4">3:4</option>
                    <option value="9:16">9:16</option>
                  </select>
                )}
              </div>
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
                  <img src={resultUrl} alt="Результат" className="max-w-full rounded-lg border object-contain max-h-[70vh]" />
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
                    <img
                      src={item.resultUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
