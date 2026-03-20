"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  StopCircle,
  Download,
  FileJson,
  FileText,
  Globe,
  Link2,
  List,
  Sparkles,
  Phone,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ImportMode = "single" | "crawl" | "batch" | "links_only";

interface PageRow {
  id: string;
  url: string;
  title: string | null;
  markdown: string | null;
  status: "pending" | "fetching" | "done" | "error";
  error?: string;
  links?: string[];
}

interface JobState {
  id: string;
  mode: string;
  status: string;
  pages: PageRow[];
  errorMessage?: string | null;
}

const TERMINAL = new Set(["completed", "cancelled", "failed"]);

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-border bg-surface/50 hover:bg-muted/50",
      )}
    >
      <span className="flex items-center gap-2 font-medium text-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

export default function WebImportPage() {
  const [mode, setMode] = useState<ImportMode>("single");
  const [startUrl, setStartUrl] = useState("");
  const [maxPages, setMaxPages] = useState(30);
  const [batchText, setBatchText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  /** Отмеченные строки (экспорт / ИИ); пусто = «все готовые» для экспорта, ИИ по превью или первой готовой */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Какая страница показана в превью */
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"explain" | "contacts" | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const pollCancel = useRef(false);

  useEffect(() => {
    if (!job?.pages?.length) return;
    setPreviewId((prev) => {
      const exists = prev && job.pages.some((p) => p.id === prev);
      return exists ? prev : job.pages[0].id;
    });
    setSelectedIds((prev) => prev.filter((id) => job.pages.some((p) => p.id === id)));
  }, [job?.pages, job?.pages?.length]);

  const previewPage =
    job?.pages?.find((p) => p.id === previewId) ?? job?.pages?.[0] ?? null;

  const togglePageSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const startJob = async () => {
    setError(null);
    setAiText(null);
    pollCancel.current = false;
    const body: Record<string, unknown> = { mode };
    try {
      if (mode === "single" || mode === "crawl" || mode === "links_only") {
        if (!startUrl.trim()) {
          setError("Введите URL");
          return;
        }
        body.startUrl = startUrl.trim();
        if (mode === "crawl") body.maxPages = maxPages;
      } else {
        const urls = batchText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (urls.length === 0) {
          setError("Добавьте хотя бы одну строку с URL");
          return;
        }
        body.urls = urls;
      }

      const res = await fetch("/api/v1/web-import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Ошибка запуска");
        return;
      }
      setJobId(data.id);
      setJob({
        id: data.id,
        mode,
        status: "pending",
        pages: [],
      });
      setSelectedIds([]);
      setPreviewId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    }
  };

  useEffect(() => {
    if (!jobId) return;
    pollCancel.current = false;

    const run = async () => {
      while (!pollCancel.current) {
        try {
          const r = await fetch(`/api/v1/web-import/jobs/${jobId}/step`, {
            method: "POST",
          });
          const data = await r.json();
          if (!r.ok) {
            setError(data.error ?? "Ошибка шага");
            break;
          }
          setJob({
            id: data.id,
            mode: data.mode,
            status: data.status,
            pages: (data.pages ?? []) as PageRow[],
            errorMessage: data.errorMessage,
          });
          if (TERMINAL.has(data.status)) break;
        } catch {
          setError("Сеть недоступна");
          break;
        }
        await new Promise((res) => setTimeout(res, 400));
      }
    };

    void run();
    return () => {
      pollCancel.current = true;
    };
  }, [jobId]);

  const stopJob = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/v1/web-import/jobs/${jobId}/cancel`, { method: "POST" });
  }, [jobId]);

  const downloadExport = async (format: "md" | "json") => {
    if (!jobId) return;
    const qs = new URLSearchParams({ format });
    if (selectedIds.length > 0) {
      qs.set("pageIds", selectedIds.join(","));
    }
    const r = await fetch(`/api/v1/web-import/jobs/${jobId}/export?${qs}`, {
      credentials: "include",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Ошибка экспорта");
      return;
    }
    const blob = await r.blob();
    const ext = format === "md" ? "md" : "json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-import.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runAi = async (aiMode: "explain" | "contacts") => {
    if (!jobId) return;
    setAiLoading(aiMode);
    setAiText(null);
    try {
      const r = await fetch("/api/v1/web-import/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          mode: aiMode,
          ...(selectedIds.length > 0
            ? { pageIds: selectedIds }
            : previewId
              ? { pageId: previewId }
              : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Ошибка AI");
        return;
      }
      setAiText(data.content as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAiLoading(null);
    }
  };

  const running = job && !TERMINAL.has(job.status);

  const aiHasMarkdown =
    selectedIds.length > 0
      ? job?.pages.some((p) => selectedIds.includes(p.id) && p.markdown) ?? false
      : !!previewPage?.markdown;

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Парсинг</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Загрузка страниц по ссылке в markdown. Обход только в пределах одного домена. Уважайте правила сайтов и
          роботов.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModeButton
          active={mode === "single"}
          onClick={() => setMode("single")}
          icon={FileText}
          label="Одна страница"
          desc="Только указанный URL"
        />
        <ModeButton
          active={mode === "crawl"}
          onClick={() => setMode("crawl")}
          icon={Globe}
          label="Обход сайта"
          desc="Страницы того же домена"
        />
        <ModeButton
          active={mode === "batch"}
          onClick={() => setMode("batch")}
          icon={List}
          desc="По одному URL на строку"
          label="Список URL"
        />
        <ModeButton
          active={mode === "links_only"}
          onClick={() => setMode("links_only")}
          icon={Link2}
          label="Список ссылок"
          desc="Все ссылки со страницы"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "batch"
              ? "Вставьте URL построчно."
              : mode === "links_only"
                ? "Укажите страницу, с которой собрать ссылки."
                : "Укажите стартовый адрес (https://…)."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode !== "batch" ? (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/page"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                disabled={!!running}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="batch">URL по одному на строку</Label>
              <Textarea
                id="batch"
                rows={6}
                placeholder={"https://a.com/1\nhttps://b.com/2"}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                disabled={!!running}
              />
            </div>
          )}

          {mode === "crawl" && (
            <div className="space-y-2">
              <Label htmlFor="max">Максимум страниц (1–100)</Label>
              <Input
                id="max"
                type="number"
                min={1}
                max={100}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value) || 30)}
                disabled={!!running}
                className="max-w-xs"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={startJob} disabled={!!running}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Идёт импорт…
                </>
              ) : (
                "Запустить"
              )}
            </Button>
            {running && jobId && (
              <Button type="button" variant="outline" onClick={stopJob}>
                <StopCircle className="mr-2 h-4 w-4" />
                Остановить
              </Button>
            )}
          </div>

          {job && (
            <p className="text-sm text-muted-foreground">
              Статус: <span className="font-medium text-foreground">{job.status}</span>
              {job.pages?.length ? ` · страниц: ${job.pages.length}` : null}
              {job.errorMessage ? ` · ${job.errorMessage}` : null}
            </p>
          )}
        </CardContent>
      </Card>

      {job && job.pages.length > 0 && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <Card className="h-fit min-w-0 w-full max-w-full lg:sticky lg:top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Страницы</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[min(60vh,520px)] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
              {job.pages.map((p) => {
                const checked = selectedIds.includes(p.id);
                const isPreview = previewId === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border px-3 py-2 transition-all duration-200",
                      checked
                        ? "border-primary bg-primary/5 shadow-sm"
                        : isPreview
                          ? "border-border bg-surface2/30"
                          : "border-transparent bg-surface2/30 hover:bg-surface2/60 hover:shadow-sm",
                    )}
                  >
                    <div
                      className="relative mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePageSelected(p.id);
                      }}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200",
                          checked
                            ? "border-primary bg-primary"
                            : "border-border bg-background group-hover:border-primary/50",
                        )}
                      >
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewId(p.id);
                        setAiText(null);
                      }}
                      className="min-w-0 flex-1 overflow-hidden text-left text-sm"
                    >
                      <div className="line-clamp-2 break-words font-medium text-foreground">
                        {p.title || p.url}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground" title={p.url}>
                        {p.url}
                      </div>
                      <div className="mt-1 text-xs">
                        {p.status === "fetching" && (
                          <span className="text-amber-600">загрузка…</span>
                        )}
                        {p.status === "done" && <span className="text-emerald-600">готово</span>}
                        {p.status === "error" && (
                          <span className="text-destructive">{p.error ?? "ошибка"}</span>
                        )}
                        {p.status === "pending" && (
                          <span className="text-muted-foreground">ожидание</span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Экспорт выбранного / всего</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Отметьте страницы слева — в файл попадут только они. Если ничего не отмечено,
                  экспортируются все успешно загруженные страницы.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => downloadExport("md")}>
                  <Download className="mr-2 h-4 w-4" />
                  Markdown
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => downloadExport("json")}>
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ИИ</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Кратко о сути текста или извлечение контактов. Если есть отмеченные страницы — по
                  ним (тексты склеиваются); иначе по странице в превью.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!aiLoading || !aiHasMarkdown}
                    onClick={() => runAi("explain")}
                  >
                    {aiLoading === "explain" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Объяснить суть
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!aiLoading || !aiHasMarkdown}
                    onClick={() => runAi("contacts")}
                  >
                    {aiLoading === "contacts" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="mr-2 h-4 w-4" />
                    )}
                    Контакты
                  </Button>
                </div>
                {aiText && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {aiText}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Превью</CardTitle>
              </CardHeader>
              <CardContent>
                {previewPage?.links &&
                  previewPage.links.length > 0 &&
                  mode === "links_only" && (
                  <div className="mb-4 max-h-48 overflow-y-auto rounded-md border border-border p-2 text-xs font-mono">
                    {previewPage.links.slice(0, 200).map((l) => (
                      <div key={l} className="truncate py-0.5">
                        {l}
                      </div>
                    ))}
                    {previewPage.links.length > 200 && (
                      <p className="text-muted-foreground">… и ещё {previewPage.links.length - 200}</p>
                    )}
                  </div>
                )}
                <pre className="max-h-[min(50vh,480px)] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground">
                  {previewPage?.markdown || "Нет текста"}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
