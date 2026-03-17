"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ImageIcon, ArrowRight, FileImage, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface TaskItem {
  id: string;
  label: string;
}

interface ModelItem {
  id: string;
  name: string;
  description?: string;
}

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
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
  const [myImages, setMyImages] = useState<FileItem[]>([]);
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

  useEffect(() => {
    if (selectedTaskId === "edit_image" || selectedTaskId === "variations") {
      fetch("/api/v1/files?scope=all&type=image")
        .then((r) => r.json())
        .then((data) => setMyImages(data.files ?? []))
        .catch(() => setMyImages([]));
    } else {
      setMyImages([]);
      setFileIds([]);
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

  const addFileId = (id: string) => {
    if (selectedModelId === "kie-flux-kontext") {
      setFileIds([id]);
    } else {
      if (fileIds.includes(id)) setFileIds((prev) => prev.filter((f) => f !== id));
      else setFileIds((prev) => (prev.length < 5 ? [...prev, id] : prev));
    }
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
    <div className="w-full py-6 px-4">
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
        {/* Блок настройки генерации — слева */}
        <form onSubmit={handleSubmit} className="w-full max-w-md shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Задача</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tasks.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant={selectedTaskId === t.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTaskId(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Модель</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingModels ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {models.map((m) => (
                    <Button
                      key={m.id}
                      type="button"
                      variant={selectedModelId === m.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedModelId(m.id)}
                    >
                      {m.name}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Промпт и изображения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Промпт</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите изображение или правки на английском или русском"
                  rows={4}
                  className="resize-none"
                />
              </div>
              {(selectedTaskId === "edit_image" || selectedTaskId === "variations") && (
                <div>
                  <label className="block text-sm font-medium mb-1">Исходное изображение (из «Мои файлы»)</label>
                  {myImages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет загруженных изображений. Загрузите фото в разделе «Мои файлы».</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {myImages.slice(0, 20).map((f) => (
                        <Button
                          key={f.id}
                          type="button"
                          variant={fileIds.includes(f.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => addFileId(f.id)}
                        >
                          <FileImage className="h-4 w-4 mr-1" />
                          {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedModelId === "kie-4o-image" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Соотношение сторон</label>
                  <div className="flex gap-2">
                    {(["1:1", "3:2", "2:3"] as const).map((s) => (
                      <Button key={s} type="button" variant={size === s ? "default" : "outline"} size="sm" onClick={() => setSize(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {selectedModelId === "kie-flux-kontext" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Соотношение сторон</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="21:9">21:9</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1</option>
                    <option value="3:4">3:4</option>
                    <option value="9:16">9:16</option>
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !selectedTaskId || !selectedModelId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Сгенерировать
            </Button>
          </div>
        </form>

        {/* Область результата — справа, с пунктирной рамкой */}
        <div
          className="flex-1 min-h-[420px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center p-6"
          style={{ minWidth: 0 }}
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
            <div className="w-full max-w-lg space-y-3 flex flex-col items-center">
              {resultUrl && (
                <img src={resultUrl} alt="Результат" className="max-w-full rounded-lg border object-contain max-h-80" />
              )}
              {(billedCredits != null || costCredits != null) && (
                <p className="text-sm text-muted-foreground">
                  Стоимость: <strong>{billedCredits ?? costCredits ?? 0}</strong> кредитов
                </p>
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
