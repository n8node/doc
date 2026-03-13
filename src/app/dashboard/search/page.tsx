"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, FileText, Loader2, Sparkles, AlertCircle, FolderOpen, Filter, ChevronDown, Check, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildDashboardFilesUrl } from "@/lib/files-navigation";

interface SearchResultChunk {
  type: "chunk";
  id: string;
  fileId: string;
  folderId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  metadata?: Record<string, unknown> | null;
}

interface SearchResultFile {
  type: "file";
  id: string;
  fileId: string;
  folderId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  similarity: number;
}

type SearchResult = SearchResultChunk | SearchResultFile;

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
const SEARCH_HISTORY_KEY = "ai-search-history";
const MAX_HISTORY = 10;

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveToSearchHistory(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  const prev = loadSearchHistory();
  const next = [q.trim(), ...prev.filter((x) => x !== q.trim())].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export default function DashboardSearchPage() {
  const [query, setQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.55);
  const [limit, setLimit] = useState(20);
  const [searchByName, setSearchByName] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (q.length < 2) return;
    if (overrideQuery) setQuery(overrideQuery);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q,
        limit: String(limit),
        threshold: String(threshold),
        searchByName: searchByName ? "true" : "false",
      });
      const res = await fetch(
        `/api/v1/files/search?${params.toString()}`,
        { signal: controller.signal },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ошибка поиска");
        setResponse(null);
      } else {
        setResponse(data);
        saveToSearchHistory(q);
        setSearchHistory(loadSearchHistory());
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [query, threshold, limit, searchByName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const defaultThreshold = 0.55;
  const defaultLimit = 20;
  const defaultSearchByName = true;
  const hasActiveSettings =
    threshold !== defaultThreshold || limit !== defaultLimit || searchByName !== defaultSearchByName;
  const resetSearchSettings = () => {
    setThreshold(defaultThreshold);
    setLimit(defaultLimit);
    setSearchByName(defaultSearchByName);
  };

  const getFilterTriggerClass = (active: boolean) =>
    `relative z-[1] flex h-10 min-w-[150px] items-center justify-between gap-2 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 ${
      active
        ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
        : "border-border bg-surface2 text-foreground hover:bg-surface2/80"
    }`;

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
        <Button onClick={() => void handleSearch()} disabled={loading || query.trim().length < 2}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Найти</span>
        </Button>
      </div>

      {searchHistory.length > 0 && !response && !loading && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Вы искали:</span>
          {searchHistory.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setError(null);
                void handleSearch(h);
              }}
              className="rounded-lg border border-border bg-surface2/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface2 hover:border-primary/30"
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl modal-glass-soft p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Filter className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Настройки поиска</span>
                {hasActiveSettings && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    изменено
                  </span>
                )}
              </div>
            </div>

            {hasActiveSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSearchSettings}
                className="h-8 gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Поиск гибридный: сначала по точным словам, затем по смыслу (семантика).
          </p>

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={getFilterTriggerClass(threshold !== defaultThreshold)}
                  >
                    <span className="truncate">
                      {THRESHOLD_PRESETS.find((p) => p.value === threshold)?.label ?? "Порог"} ({threshold})
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {THRESHOLD_PRESETS.map((p) => (
                    <DropdownMenuItem
                      key={p.value}
                      onClick={() => setThreshold(p.value)}
                      className="justify-between"
                    >
                      <span>{p.label} ({p.value})</span>
                      {threshold === p.value && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={getFilterTriggerClass(limit !== defaultLimit)}
                  >
                    <span className="truncate">Результатов: {limit}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {LIMIT_OPTIONS.map((n) => (
                    <DropdownMenuItem
                      key={n}
                      onClick={() => setLimit(n)}
                      className="justify-between"
                    >
                      <span>{n}</span>
                      {limit === n && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <label
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
                  searchByName
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={searchByName}
                  onChange={(e) => setSearchByName(e.target.checked)}
                  className="sr-only"
                />
                <span className="whitespace-nowrap">По названиям файлов</span>
              </label>
            </div>
          </div>
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
                ? `Найдено ${response.total} результат${response.total === 1 ? "" : response.total < 5 ? "а" : "ов"}`
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
                  <div className="flex items-center gap-2">
                    <SimilarityBadge score={r.similarity} />
                    {r.folderId != null && (
                      <Link
                        href={buildDashboardFilesUrl({
                          folderId: r.folderId,
                          highlightFileId: r.fileId,
                        })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface2/80 transition-colors"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Посмотреть на диске
                      </Link>
                    )}
                    {r.folderId == null && (
                      <Link
                        href={buildDashboardFilesUrl({
                          highlightFileId: r.fileId,
                        })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface2/80 transition-colors"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Посмотреть на диске
                      </Link>
                    )}
                  </div>
                </div>
                {r.type === "chunk" && (
                  <>
                    <p
                      className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: highlightMatch(r.chunkText, response.query),
                      }}
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                      Фрагмент #{r.chunkIndex + 1}
                    </div>
                  </>
                )}
                {r.type === "file" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Совпадение по названию файла
                  </p>
                )}
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
