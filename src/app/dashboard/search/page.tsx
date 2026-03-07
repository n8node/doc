"use client";

import { useState, useCallback, useRef } from "react";
import { Search, FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SearchResult {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  provider?: string;
  total: number;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return text;
  const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.replace(regex, '<mark class="bg-yellow-300/30 text-foreground rounded px-0.5">$1</mark>');
}

function SimilarityBadge({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  const color =
    percent >= 80
      ? "text-emerald-500 bg-emerald-500/10"
      : percent >= 60
        ? "text-amber-500 bg-amber-500/10"
        : "text-muted-foreground bg-muted";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Sparkles className="h-3 w-3" />
      {percent}%
    </span>
  );
}

const THRESHOLD_PRESETS = [
  { value: 0.45, label: "Широкий" },
  { value: 0.55, label: "Стандартный" },
  { value: 0.65, label: "Строгий" },
] as const;

const LIMIT_OPTIONS = [10, 20, 50] as const;

export default function DashboardSearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.55);
  const [limit, setLimit] = useState(20);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v1/files/search?q=${encodeURIComponent(q)}&limit=${limit}&threshold=${threshold}`,
        { signal: controller.signal },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ошибка поиска");
        setResponse(null);
      } else {
        setResponse(data);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [query, threshold, limit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI-поиск по документам</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Семантический поиск — находит релевантные фрагменты по смыслу, а не только по точному совпадению
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Например: как настроить авторизацию, отчёт по продажам..."
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || query.trim().length < 2}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Найти</span>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface2/30 px-4 py-3 space-y-4">
        <p className="text-xs text-muted-foreground">
          Поиск гибридный: сначала по точным словам, затем по смыслу (семантика).
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Порог релевантности
          </label>
          <p className="text-xs text-muted-foreground">
            Чем выше — тем строже отбор. Ниже — больше результатов, но может быть шум.
          </p>
          <div className="flex flex-wrap gap-2">
            {THRESHOLD_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setThreshold(p.value)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  threshold === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface2 text-muted-foreground hover:bg-surface2/80 hover:text-foreground"
                }`}
              >
                {p.label} ({p.value})
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="search-limit" className="text-sm font-medium text-foreground">
            Количество результатов
          </label>
          <p className="text-xs text-muted-foreground">
            Максимальное число фрагментов в выдаче.
          </p>
          <select
            id="search-limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {response && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {response.total > 0
                ? `Найдено ${response.total} фрагмент${response.total === 1 ? "" : response.total < 5 ? "а" : "ов"}`
                : "Ничего не найдено"}
            </span>
            {response.provider && (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {response.provider}
              </span>
            )}
          </div>

          {response.results.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  По запросу &quot;{response.query}&quot; ничего не найдено.
                  <br />
                  Убедитесь, что документы загружены и обработаны AI.
                </p>
              </CardContent>
            </Card>
          )}

          {response.results.map((r) => (
            <Card key={r.id} className="overflow-hidden transition-shadow hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                    <a
                      href={`/dashboard/files`}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {r.fileName}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(r.fileSize)}
                    </span>
                  </div>
                  <SimilarityBadge score={r.similarity} />
                </div>
                <p
                  className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatch(r.chunkText, response.query),
                  }}
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  Фрагмент #{r.chunkIndex + 1}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!response && !error && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Семантический поиск</p>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Введите запрос на естественном языке. AI найдёт релевантные фрагменты
              из ваших документов по смыслу.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
