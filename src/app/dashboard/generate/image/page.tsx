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
        setModels(data.models ?? []);
        setSelectedModelId((data.models ?? [])[0]?.id ?? "");
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

  const pollStatus = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/generate/image/status?taskId=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Ошибка");
    setStatus(data.status);
    if (data.resultUrl) setResultUrl(data.resultUrl);
    if (data.fileId) setFileId(data.fileId);
    if (data.costCredits != null) setCostCredits(data.costCredits);
    if (data.billedCredits != null) setBilledCredits(data.billedCredits);
    if (data.errorMessage) setErrorMessage(data.errorMessage);
    return data.status;
  }, []);

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
        aspectRatio: selectedModelId === "kie-flux-kontext" ? aspectRatio : undefined,
      };
      const res = await fetch("/api/v1/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка запуска");
      setTaskId(data.taskId);
      setStatus(data.status ?? "processing");
      toast.success("Генерация запущена");
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
    fileInputRef.current?.value && (fileInputRef.current.value = "");
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

          {/* Сегментированный выбор модели */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Модель</label>
            {loadingModels ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            ) : (
              <div className="inline-flex rounded-lg border border-input bg-muted/30 p-0.5">
                {models.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelId(m.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedModelId === m.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    } ${i === 0 ? "rounded-l-md" : ""} ${i === models.length - 1 ? "rounded-r-md" : ""}`}
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

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Сбросить
            </Button>
            <Button type="submit" disabled={submitting || !selectedTaskId || !selectedModelId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Сгенерировать
            </Button>
          </div>
        </form>

        {/* Область результата — на весь оставшийся экран, пунктирная рамка */}
        <div
          className="flex-1 min-w-0 min-h-[420px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center p-6"
        >
          {!status && (
            <p className="text-muted-foreground text-center text-sm">
              Здесь появится результат генерации
            </p>
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
              {/* Стоимость генерации: с учётом наценки из админки (billedCredits уже включает margin) */}
              {(billedCredits != null || costCredits != null) && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 border border-border">
                  <Coins className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      Стоимость генерации: <strong>{billedCredits ?? costCredits ?? 0}</strong> кредитов
                    </p>
                    <p className="text-xs text-muted-foreground">
                      С учётом наценки из настроек админки
                    </p>
                  </div>
                </div>
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
      </div>
    </div>
  );
}
