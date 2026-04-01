"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Upload, X, Coins, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PENDING_KEY = "dropbox-ru-video-gen-pending";

interface TaskItem {
  id: string;
  label: string;
}

interface ModelItem {
  id: string;
  name: string;
  description?: string;
}

export default function GenerateVideoPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [sound, setSound] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [startFrameId, setStartFrameId] = useState<string | null>(null);
  const [endFrameId, setEndFrameId] = useState<string | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [motionImageId, setMotionImageId] = useState<string | null>(null);
  const [motionVideoId, setMotionVideoId] = useState<string | null>(null);
  const [motionImagePreview, setMotionImagePreview] = useState<string | null>(null);
  const [motionVideoPreview, setMotionVideoPreview] = useState<string | null>(null);
  const [motionMode, setMotionMode] = useState<"720p" | "1080p">("720p");
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("video");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [costCredits, setCostCredits] = useState<number | null>(null);
  const [billedCredits, setBilledCredits] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ url: string; fileId?: string | null }>>([]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/generate/video/recent");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) return;
      setRecent(
        (data.items as { fileId: string; url: string }[]).map((i) => ({ url: i.url, fileId: i.fileId })).reverse()
      );
    } catch {
      // ignore
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/v1/generate/video/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
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
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!selectedTaskId) {
      setModels([]);
      setSelectedModelId("");
      return;
    }
    setLoadingModels(true);
    fetch(`/api/v1/generate/video/models?taskId=${encodeURIComponent(selectedTaskId)}`)
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

  const clearPending = useCallback(() => {
    try {
      window.localStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
  }, []);

  const pollStatus = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/generate/video/status?taskId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setStatus(data.status);
      if (data.resultUrl) setResultUrl(data.resultUrl);
      if (data.fileId) setFileId(data.fileId);
      if (data.costCredits != null) setCostCredits(data.costCredits);
      if (data.billedCredits != null) setBilledCredits(data.billedCredits);
      if (data.errorMessage) setErrorMessage(data.errorMessage);
      if (data.status === "success" && data.resultUrl) {
        setRecent((prev) => [...prev.slice(-3), { url: data.resultUrl!, fileId: data.fileId ?? null }].slice(-4));
      }
      if (data.status === "success" || data.status === "failed") clearPending();
      return data.status as string;
    },
    [clearPending]
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
    }, 4000);
    return () => clearInterval(t);
  }, [taskId, status, pollStatus]);

  const uploadFile = async (file: File) => {
    const initRes = await fetch("/api/v1/files/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, mimeType: file.type, folderId: null }),
    });
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error ?? "Ошибка инициализации");
    const { uploadUrl, uploadHeaders, uploadSessionToken } = initData;
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": uploadHeaders?.["Content-Type"] ?? file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error("Ошибка загрузки");
    const completeRes = await fetch("/api/v1/files/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadSessionToken }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error ?? "Ошибка завершения");
    return completeData.id as string;
  };

  const onPickStartFrame = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }
    setUploading(true);
    try {
      if (startPreview) URL.revokeObjectURL(startPreview);
      const id = await uploadFile(f);
      setStartFrameId(id);
      setStartPreview(URL.createObjectURL(f));
      toast.success("Стартовый кадр загружен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUploading(false);
    }
  };

  const onPickEndFrame = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }
    setUploading(true);
    try {
      if (endPreview) URL.revokeObjectURL(endPreview);
      const id = await uploadFile(f);
      setEndFrameId(id);
      setEndPreview(URL.createObjectURL(f));
      toast.success("Финальный кадр загружен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUploading(false);
    }
  };

  const onPickMotionImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) {
      toast.error("Выберите изображение персонажа");
      return;
    }
    setUploading(true);
    try {
      if (motionImagePreview) URL.revokeObjectURL(motionImagePreview);
      const id = await uploadFile(f);
      setMotionImageId(id);
      setMotionImagePreview(URL.createObjectURL(f));
      toast.success("Референс-изображение загружено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUploading(false);
    }
  };

  const onPickMotionVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("video/")) {
      toast.error("Выберите видео (mp4, webm…)");
      return;
    }
    setUploading(true);
    try {
      if (motionVideoPreview) URL.revokeObjectURL(motionVideoPreview);
      const id = await uploadFile(f);
      setMotionVideoId(id);
      setMotionVideoPreview(URL.createObjectURL(f));
      toast.success("Референс-видео загружено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !selectedModelId) {
      toast.error("Выберите задачу и модель");
      return;
    }
    if (selectedModelId === "kie-kling-30-video" && !prompt.trim()) {
      toast.error("Введите промпт");
      return;
    }
    if (selectedModelId === "kie-kling-30-motion") {
      if (!motionImageId || !motionVideoId) {
        toast.error("Загрузите изображение и видео для motion control");
        return;
      }
    }
    if (endFrameId && !startFrameId) {
      toast.error("Для финального кадра укажите и стартовый кадр");
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
      };
      if (selectedModelId === "kie-kling-30-video") {
        body.duration = duration;
        body.mode = mode;
        body.sound = sound;
        body.aspectRatio = aspectRatio;
        if (startFrameId) body.startFrameFileId = startFrameId;
        if (endFrameId) body.endFrameFileId = endFrameId;
        body.multiShots = false;
      } else {
        body.motionImageFileId = motionImageId;
        body.motionVideoFileId = motionVideoId;
        body.motionMode = motionMode;
        body.characterOrientation = characterOrientation;
      }

      const res = await fetch("/api/v1/generate/video", {
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
        window.localStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ taskId: data.taskId, selectedTaskId, selectedModelId })
        );
      } catch {
        // ignore
      }
      if (data.status === "queued" && data.message) toast.info(data.message);
      else toast.success("Генерация запущена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
      setStatus(null);
      setTaskId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const restoreRef = useRef(false);
  useEffect(() => {
    if (restoreRef.current) return;
    restoreRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let saved: { taskId?: string };
    try {
      saved = JSON.parse(raw) as { taskId?: string };
    } catch {
      return;
    }
    if (!saved.taskId) return;
    fetch(`/api/v1/generate/video/status?taskId=${encodeURIComponent(saved.taskId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setTaskId(saved.taskId!);
        setStatus(data.status);
        if (data.status === "success") {
          if (data.resultUrl) setResultUrl(data.resultUrl);
          if (data.fileId) setFileId(data.fileId);
          if (data.costCredits != null) setCostCredits(data.costCredits);
          if (data.billedCredits != null) setBilledCredits(data.billedCredits);
          clearPending();
        } else if (data.status === "failed") {
          if (data.errorMessage) setErrorMessage(data.errorMessage);
          clearPending();
        }
      })
      .catch(() => {});
  }, [clearPending]);

  if (loadingTasks && tasks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-6 w-6" />
              Генерация видео
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Раздел отключён или недоступен по вашему тарифу. Выберите тариф с генерацией видео или обратитесь в поддержку.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Video className="h-7 w-7" />
          Генерация видео
        </h1>
        <p className="text-muted-foreground mt-1">
          Готовые ролики сохраняются в «Мои файлы». Списание кредитов зависит от модели, длительности и выбранных параметров качества.
        </p>
      </div>

      <div className="flex gap-8 items-start flex-col lg:flex-row">
        <form onSubmit={handleSubmit} className="flex-[0_0_38%] min-w-[320px] max-w-[520px] space-y-4 w-full">
          <div>
            <Label className="text-muted-foreground">Задача</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedTaskId === t.id ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Модель</Label>
            {loadingModels ? (
              <Loader2 className="h-5 w-5 animate-spin mt-2" />
            ) : (
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            {models.find((m) => m.id === selectedModelId)?.description && (
              <p className="text-xs text-muted-foreground mt-1">{models.find((m) => m.id === selectedModelId)?.description}</p>
            )}
          </div>

          {selectedModelId === "kie-kling-30-video" && (
            <>
              <div>
                <Label htmlFor="v-prompt">Промпт</Label>
                <Textarea
                  id="v-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="mt-1"
                  placeholder="Опишите сцену, движение камеры, реплики…"
                />
              </div>
              <div>
                <Label>Длительность: {duration} с</Label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  className="w-full mt-2"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <Label>Качество</Label>
                  <div className="flex gap-2 mt-1">
                    {(["std", "pro"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`rounded border px-3 py-1 text-sm ${mode === m ? "border-primary bg-primary/10" : ""}`}
                      >
                        {m === "std" ? "Standard" : "Pro"}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                  <span className="text-sm">Звук / речь</span>
                </label>
              </div>
              <div>
                <Label>Соотношение сторон</Label>
                <p className="text-xs text-muted-foreground mb-1">Если загрузите кадры — можно не задавать (по размеру картинок).</p>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Кадры (необязательно)</Label>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <input type="file" accept="image/*" className="hidden" id="vf-start" onChange={onPickStartFrame} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById("vf-start")?.click()}>
                      <Upload className="h-4 w-4 mr-1" />
                      Старт
                    </Button>
                    {startPreview && (
                      <div className="relative mt-2 w-24 h-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={startPreview} alt="" className="rounded object-cover w-full h-full" />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                          onClick={() => {
                            if (startPreview) URL.revokeObjectURL(startPreview);
                            setStartPreview(null);
                            setStartFrameId(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/*" className="hidden" id="vf-end" onChange={onPickEndFrame} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById("vf-end")?.click()}>
                      <Upload className="h-4 w-4 mr-1" />
                      Финиш
                    </Button>
                    {endPreview && (
                      <div className="relative mt-2 w-24 h-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={endPreview} alt="" className="rounded object-cover w-full h-full" />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                          onClick={() => {
                            if (endPreview) URL.revokeObjectURL(endPreview);
                            setEndPreview(null);
                            setEndFrameId(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedModelId === "kie-kling-30-motion" && (
            <>
              <div>
                <Label htmlFor="m-prompt">Промпт (необязательно)</Label>
                <Textarea
                  id="m-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Пожелания по качеству и согласованности…"
                />
              </div>
              <div>
                <input type="file" accept="image/*" className="hidden" id="mf-img" onChange={onPickMotionImage} />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => document.getElementById("mf-img")?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Референс-изображение
                </Button>
                {motionImagePreview && (
                  <div className="relative mt-2 w-32 h-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={motionImagePreview} alt="" className="rounded object-cover w-full h-full" />
                  </div>
                )}
              </div>
              <div>
                <input type="file" accept="video/*" className="hidden" id="mf-vid" onChange={onPickMotionVideo} />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => document.getElementById("mf-vid")?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Референс-видео (движение)
                </Button>
                {motionVideoPreview && (
                  <video src={motionVideoPreview} className="mt-2 max-h-40 rounded border" controls muted />
                )}
              </div>
              <div>
                <Label>Разрешение выхода</Label>
                <div className="flex gap-2 mt-1">
                  {(["720p", "1080p"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMotionMode(m)}
                      className={`rounded border px-3 py-1 text-sm ${motionMode === m ? "border-primary bg-primary/10" : ""}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Ориентация персонажа</Label>
                <p className="text-xs text-muted-foreground">«Как на фото» — до 10 с референс-видео; «Как в видео» — до 30 с.</p>
                <div className="flex gap-2 mt-1">
                  {(["image", "video"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setCharacterOrientation(o)}
                      className={`rounded border px-3 py-1 text-sm ${characterOrientation === o ? "border-primary bg-primary/10" : ""}`}
                    >
                      {o === "image" ? "Как на фото" : "Как в видео"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button type="submit" disabled={submitting || uploading} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Запустить генерацию
          </Button>
        </form>

        <div className="flex-1 min-w-0 space-y-4 w-full">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Результат</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {errorMessage && (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {errorMessage}
                </div>
              )}
              {status === "queued" && <p className="text-muted-foreground text-sm">В очереди…</p>}
              {(status === "processing" || status === "queued") && taskId && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Генерация может занять несколько минут.
                </p>
              )}
              {resultUrl && (
                <video src={resultUrl} className="w-full max-w-2xl rounded-lg border bg-black" controls playsInline />
              )}
              {(costCredits != null || billedCredits != null) && (
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4" />
                  Списано кредитов: {billedCredits ?? costCredits}
                </p>
              )}
              {fileId && (
                <Link
                  href="/dashboard/files?section=my-files"
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                >
                  Открыть в «Мои файлы»
                </Link>
              )}
            </CardContent>
          </Card>

          {recent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Недавние</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {recent.map((r, i) => (
                  <video key={i} src={r.url} className="h-28 w-48 rounded border object-cover bg-black" muted playsInline />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
