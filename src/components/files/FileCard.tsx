"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  Presentation,
  Download,
  Share2,
  Trash2,
  Play,
  FolderOpen,
  FolderInput,
  Copy,
  Pencil,
  Clock,
  Check,
  Link2,
  ScanSearch,
  BrainCircuit,
  MessageCircle,
  Mic2,
  Database,
  Lock,
  Table2,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatBytes } from "@/lib/utils";
import { TranscriptionProgressBar } from "./TranscriptionProgressBar";

interface FileCardProps {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  mediaMetadata?: { durationSeconds?: number } | null;
  aiMetadata?: {
    processedAt?: string;
    numPages?: number;
    tablesCount?: number;
    transcriptProcessedAt?: string;
    transcriptProvider?: string;
  } | null;
  hasShareLink?: boolean;
  shareLinksCount?: number;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onPlay?: () => void;
  onDownload: () => void;
  onShare: () => void;
  onMove?: () => void;
  onCopy?: () => void;
  onRename?: () => void;
  onShareLinksClick?: () => void;
  onProcess?: () => void;
  onTranscribe?: () => void;
  processLocked?: string;
  transcribeLocked?: string;
  onViewTranscript?: () => void;
  onEmbedTranscript?: () => void;
  isEmbeddingTranscript?: boolean;
  embedTranscriptError?: string;
  embedTranscriptLocked?: string;
  hasEmbedding?: boolean;
  onChat?: () => void;
  onDelete: () => void;
  index: number;
  isProcessable?: boolean;
  isAnalyzing?: boolean;
  analyzeError?: string;
  analyzeEstimateMinutes?: number;
  analyzeStartedAt?: number;
  isTranscribable?: boolean;
  isTranscribing?: boolean;
  transcribingProvider?: string;
  transcribeError?: string;
  transcribeEstimateMinutes?: number;
  transcribeStartedAt?: number;
  importedSheetId?: string | null;
  onImportToTable?: () => void;
  isExcelFile?: boolean;
  importingToTable?: boolean;
}

interface FolderCardProps {
  id: string;
  name: string;
  createdAt: string;
  hasShareLink?: boolean;
  shareLinksCount?: number;
  filesCount?: number;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onClick: () => void;
  onShare: () => void;
  onShareLinksClick?: () => void;
  onMove?: () => void;
  onCopy?: () => void;
  onRename?: () => void;
  onDelete: () => void;
  index: number;
}

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
]);

function isImageFile(mimeType: string, fileName: string) {
  if (mimeType.startsWith("image/")) return true;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.has(ext);
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return { icon: FileImage, color: "text-pink-500", bg: "bg-pink-500/10" };
  }
  if (mimeType.startsWith("video/")) {
    return { icon: FileVideo, color: "text-purple-500", bg: "bg-purple-500/10" };
  }
  if (mimeType.startsWith("audio/")) {
    return { icon: FileAudio, color: "text-green-500", bg: "bg-green-500/10" };
  }
  if (mimeType === "application/pdf") {
    return { icon: FileText, color: "text-red-500", bg: "bg-red-500/10" };
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    return { icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-500/10" };
  }
  if (
    mimeType.includes("document") ||
    mimeType.includes("word") ||
    mimeType === "application/rtf"
  ) {
    return { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" };
  }
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  ) {
    return { icon: Presentation, color: "text-orange-500", bg: "bg-orange-500/10" };
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z") ||
    mimeType.includes("compressed") ||
    mimeType.includes("archive")
  ) {
    return { icon: FileArchive, color: "text-amber-500", bg: "bg-amber-500/10" };
  }
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css") ||
    mimeType.includes("xml") ||
    mimeType.startsWith("text/x-")
  ) {
    return { icon: FileCode, color: "text-cyan-500", bg: "bg-cyan-500/10" };
  }
  if (mimeType.startsWith("text/")) {
    return { icon: FileText, color: "text-slate-500", bg: "bg-slate-500/10" };
  }
  return { icon: File, color: "text-muted-foreground", bg: "bg-surface2" };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeLabel = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) {
    return `Сегодня ${timeLabel}`;
  }
  if (diffDays === 1) {
    return `Вчера ${timeLabel}`;
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-surface2 hover:text-foreground";

export function FileCard({
  id,
  name,
  mimeType,
  size,
  createdAt,
  mediaMetadata,
  aiMetadata,
  hasShareLink = false,
  shareLinksCount = 0,
  selected,
  onSelect,
  onPlay,
  onDownload,
  onShare,
  onMove,
  onCopy,
  onRename,
  onShareLinksClick,
  onProcess,
  onTranscribe,
  processLocked,
  transcribeLocked,
  onViewTranscript,
  onEmbedTranscript,
  isEmbeddingTranscript,
  embedTranscriptError,
  embedTranscriptLocked,
  hasEmbedding,
  onChat,
  onDelete,
  index,
  isProcessable = false,
  isAnalyzing,
  analyzeError,
  analyzeEstimateMinutes,
  analyzeStartedAt,
  isTranscribable = false,
  isTranscribing,
  transcribingProvider,
  transcribeEstimateMinutes,
  transcribeStartedAt,
  transcribeError,
  importedSheetId,
  onImportToTable,
  isExcelFile = false,
  importingToTable = false,
}: FileCardProps) {
  const { icon: Icon, color, bg } = getFileIcon(mimeType);
  const [thumbnailError, setThumbnailError] = useState(false);
  const showThumbnail = isImageFile(mimeType, name) && !thumbnailError;
  const isMedia = mimeType.startsWith("video/") || mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");
  const isProcessed = !!aiMetadata?.processedAt;
  const isTranscribed = !!aiMetadata?.transcriptProcessedAt;

  const formatTranscriptProvider = (p: string | undefined): string => {
    if (!p) return "";
    if (p === "openai_whisper" || p === "OpenAI") return "OpenAI";
    if (p === "openrouter" || p === "openrouter_transcription" || p === "OpenRouter") return "OpenRouter";
    if (p === "docling" || p === "Docling" || p === "QoQon") return "QoQon";
    return p;
  };

  const transcriptProviderDisplay =
    isTranscribing ? formatTranscriptProvider(transcribingProvider) : formatTranscriptProvider(aiMetadata?.transcriptProvider);
  // Для OpenRouter не показываем суффикс — только «Транскрипт»
  const transcriptProviderSuffix =
    transcriptProviderDisplay && transcriptProviderDisplay !== "OpenRouter" ? ` — ${transcriptProviderDisplay}` : "";

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
        className={cn(
          "group relative flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-200",
          selected
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-transparent bg-surface2/30 hover:bg-surface2/60 hover:shadow-sm"
        )}
      >
        {/* Checkbox */}
        <div
          className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id, !selected);
          }}
        >
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200",
              selected
                ? "border-primary bg-primary"
                : "border-border bg-background group-hover:border-primary/50"
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" />}
          </div>
        </div>

        {/* Icon / image thumbnail */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl",
            showThumbnail ? "bg-surface2" : bg
          )}
        >
          {showThumbnail ? (
            <img
              src={`/api/v1/files/${id}/stream`}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <Icon className={cn("h-5 w-5", color)} />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(size)}</span>
            {mediaMetadata?.durationSeconds != null && (
              <>
                <span>•</span>
                <span>{formatDuration(mediaMetadata.durationSeconds)}</span>
              </>
            )}
            <span>•</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(createdAt)}
            </span>
            {isProcessable && isAnalyzing && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                {analyzeEstimateMinutes != null && analyzeEstimateMinutes > 0 && analyzeStartedAt != null ? (
                  <TranscriptionProgressBar
                    startTimestamp={analyzeStartedAt}
                    estimatedSeconds={analyzeEstimateMinutes * 60}
                    variant="compact"
                    label="Анализ"
                    icon={ScanSearch}
                    color="emerald"
                  />
                ) : (
                  <span className="flex items-center gap-1 text-emerald-500 animate-pulse" title="Анализируется...">
                    <ScanSearch className="h-3 w-3" />
                    Анализ...
                  </span>
                )}
              </span>
            )}
            {isProcessable && analyzeError && !isAnalyzing && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <span className="flex items-center gap-1 text-red-500" title={analyzeError}>
                  <BrainCircuit className="h-3 w-3" />
                  Ошибка
                </span>
              </span>
            )}
            {((isProcessable && isProcessed) || (isTranscribable && !!hasEmbedding)) && !isAnalyzing && !isEmbeddingTranscript && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 font-medium" title="Документ обработан AI">
                  <BrainCircuit className="h-3 w-3" />
                  AI
                </span>
              </span>
            )}
            {importingToTable && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-2">
                <span>•</span>
                <span
                  className="flex items-center gap-2 text-emerald-500"
                  title="Импорт в таблицу..."
                >
                  <Table2 className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Импорт в таблицу...</span>
                  <div className="h-1.5 w-16 min-w-16 overflow-hidden rounded-full bg-emerald-500/20">
                    <div
                      className="h-full rounded-full bg-emerald-500 animate-pulse"
                      style={{ width: "60%" }}
                    />
                  </div>
                </span>
              </span>
            )}
            {isTranscribable && isTranscribing && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1.5">
                <span>•</span>
                {transcribeEstimateMinutes != null && transcribeEstimateMinutes > 0 && transcribeStartedAt != null ? (
                  <span className="flex items-center gap-1.5">
                    <TranscriptionProgressBar
                      startTimestamp={transcribeStartedAt}
                      estimatedSeconds={transcribeEstimateMinutes * 60}
                      variant="compact"
                    />
                    {transcriptProviderDisplay && (
                      <span className="text-amber-600 font-medium">{transcriptProviderDisplay}</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500 animate-pulse" title={transcriptProviderDisplay ? `Транскрибируется... ${transcriptProviderDisplay}` : "Транскрибируется..."}>
                    <Mic2 className="h-3 w-3" />
                    Транскрипция…
                    {transcriptProviderDisplay && (
                      <span className="text-amber-600 font-medium">{transcriptProviderDisplay}</span>
                    )}
                  </span>
                )}
              </span>
            )}
            {isTranscribable && transcribeError && !isTranscribing && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <span className="flex items-center gap-1 text-red-500" title={transcribeError}>
                  <Mic2 className="h-3 w-3" />
                  Ошибка
                </span>
              </span>
            )}
            {isTranscribable && embedTranscriptError && !isEmbeddingTranscript && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <span className="flex items-center gap-1 text-red-500" title={embedTranscriptError}>
                  <BrainCircuit className="h-3 w-3" />
                  Ошибка индексации
                </span>
              </span>
            )}
            {isTranscribable && isTranscribed && !isTranscribing && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                {onViewTranscript ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTranscript();
                    }}
                    className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium transition-colors hover:bg-amber-500/20"
                    title={`Просмотр транскрипта${transcriptProviderSuffix}`}
                  >
                    <Mic2 className="h-3 w-3" />
                    Транскрипт{transcriptProviderSuffix}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium" title={`Транскрипт готов${transcriptProviderSuffix}`}>
                    <Mic2 className="h-3 w-3" />
                    Транскрипт{transcriptProviderSuffix}
                  </span>
                )}
              </span>
            )}
            {hasShareLink && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareLinksClick?.();
                  }}
                  className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary transition-colors hover:bg-primary/20"
                >
                  <Link2 className="h-3 w-3" />
                  Ссылка{shareLinksCount > 1 ? ` (${shareLinksCount})` : ""}
                </button>
              </span>
            )}
            {onChat && (isProcessed || (isTranscribable && !!hasEmbedding)) && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChat();
                  }}
                  className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-600 transition-colors hover:bg-cyan-500/20"
                  title="Чат по документу"
                >
                  <MessageCircle className="h-3 w-3" />
                  Чат
                </button>
              </span>
            )}
            {(isProcessed || (isTranscribable && !!hasEmbedding)) && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <Link
                  href={`/dashboard/embeddings/${id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-600 transition-colors hover:bg-violet-500/20"
                  title="Таблица эмбеддингов"
                >
                  <Database className="h-3 w-3" />
                  Эмбеддинг
                </Link>
              </span>
            )}
            {importedSheetId && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <Link
                  href={`/dashboard/sheets/${importedSheetId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                  title="Открыть таблицу"
                >
                  <Table2 className="h-3 w-3" />
                  Таблица
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Actions: kebab menu on mobile, inline on desktop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground sm:hidden"
              onClick={(e) => e.stopPropagation()}
              aria-label="Действия"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            {isMedia && onPlay && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPlay?.(); }}>
                <Play className="mr-2 h-4 w-4" />
                {isVideo ? "Смотреть видео" : "Слушать аудио"}
              </DropdownMenuItem>
            )}
            {isExcelFile && onImportToTable && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onImportToTable?.(); }} disabled={importingToTable}>
                <Table2 className="mr-2 h-4 w-4" />
                Импорт в таблицу
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }}>
              <Download className="mr-2 h-4 w-4" />
              Скачать
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться
            </DropdownMenuItem>
            {onMove && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                <FolderInput className="mr-2 h-4 w-4" />
                Переместить
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                <Copy className="mr-2 h-4 w-4" />
                Копировать
              </DropdownMenuItem>
            )}
            {onRename && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Переименовать
              </DropdownMenuItem>
            )}
            {(onProcess || (processLocked && isProcessable)) && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onProcess?.(); }} disabled={!!processLocked}>
                <ScanSearch className="mr-2 h-4 w-4" />
                Анализ документа
              </DropdownMenuItem>
            )}
            {(onTranscribe || (transcribeLocked && isTranscribable)) && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTranscribe?.(); }} disabled={!!transcribeLocked}>
                <Mic2 className="mr-2 h-4 w-4" />
                Транскрибировать
              </DropdownMenuItem>
            )}
            {(onEmbedTranscript || (embedTranscriptLocked && isTranscribable && isTranscribed)) && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEmbedTranscript?.(); }} disabled={!!embedTranscriptLocked || isEmbeddingTranscript}>
                <BrainCircuit className="mr-2 h-4 w-4" />
                AI-обработка транскрипта
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-error focus:text-error"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="hidden items-center gap-1 sm:flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          {isMedia && onPlay && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white"
                >
                  <Play className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isVideo ? "Смотреть видео" : "Слушать аудио"}</TooltipContent>
            </Tooltip>
          )}

          {isExcelFile && onImportToTable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImportToTable();
                  }}
                  disabled={importingToTable}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-50"
                  title="Импорт в таблицу"
                >
                  {importingToTable ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  ) : (
                    <Table2 className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Импорт в раздел «Таблицы»</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                className={ACTION_BTN}
              >
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Скачать</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
                className={ACTION_BTN}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Поделиться</TooltipContent>
          </Tooltip>

          {onMove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove();
                  }}
                  className={ACTION_BTN}
                >
                  <FolderInput className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Переместить</TooltipContent>
            </Tooltip>
          )}

          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy();
                  }}
                  className={ACTION_BTN}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Копировать</TooltipContent>
            </Tooltip>
          )}

          {onRename && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename();
                  }}
                  className={ACTION_BTN}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Переименовать</TooltipContent>
            </Tooltip>
          )}

          {(onProcess || (processLocked && isProcessable)) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onProcess) onProcess();
                  }}
                  disabled={!!processLocked}
                  className={cn(
                    ACTION_BTN,
                    processLocked
                      ? "cursor-not-allowed text-muted-foreground opacity-60"
                      : "text-emerald-500 hover:bg-emerald-500/10"
                  )}
                >
                  {processLocked ? <Lock className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {processLocked ?? "Анализ документа"}
              </TooltipContent>
            </Tooltip>
          )}

          {(onTranscribe || (transcribeLocked && isTranscribable)) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTranscribe) onTranscribe();
                  }}
                  disabled={!!transcribeLocked}
                  className={cn(
                    ACTION_BTN,
                    transcribeLocked
                      ? "cursor-not-allowed text-muted-foreground opacity-60"
                      : "text-amber-500 hover:bg-amber-500/10"
                  )}
                >
                  {transcribeLocked ? <Lock className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {transcribeLocked ?? "Транскрибировать"}
              </TooltipContent>
            </Tooltip>
          )}

          {(onEmbedTranscript || (embedTranscriptLocked && isTranscribable && isTranscribed)) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEmbedTranscript) onEmbedTranscript();
                  }}
                  disabled={!!embedTranscriptLocked || isEmbeddingTranscript}
                  className={cn(
                    ACTION_BTN,
                    embedTranscriptLocked
                      ? "cursor-not-allowed text-muted-foreground opacity-60"
                      : "text-emerald-500 hover:bg-emerald-500/10"
                  )}
                >
                  {embedTranscriptLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : isEmbeddingTranscript ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  ) : (
                    <BrainCircuit className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {embedTranscriptLocked ?? (isEmbeddingTranscript ? "Индексация..." : "AI-обработка транскрипта")}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={cn(
                  ACTION_BTN,
                  "text-error hover:bg-error/10 hover:text-error"
                )}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Удалить</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

export function FolderCard({
  id,
  name,
  createdAt,
  hasShareLink = false,
  shareLinksCount = 0,
  filesCount,
  selected,
  onSelect,
  onClick,
  onShare,
  onShareLinksClick,
  onMove,
  onCopy,
  onRename,
  onDelete,
  index,
}: FolderCardProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-200",
          selected
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-transparent bg-surface2/30 hover:bg-surface2/60 hover:shadow-sm"
        )}
        onClick={onClick}
      >
        {/* Checkbox */}
        <div
          className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id, !selected);
          }}
        >
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200",
              selected
                ? "border-primary bg-primary"
                : "border-border bg-background group-hover:border-primary/50"
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" />}
          </div>
        </div>

        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Папка</span>
            {filesCount !== undefined && (
              <>
                <span>•</span>
                <span>Файлов: {filesCount}</span>
              </>
            )}
            <span>•</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(createdAt)}
            </span>
            {hasShareLink && (
              <span className="hidden shrink-0 sm:inline-flex sm:items-center sm:gap-1">
                <span>•</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareLinksClick?.();
                  }}
                  className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary transition-colors hover:bg-primary/20"
                >
                  <Link2 className="h-3 w-3" />
                  {shareLinksCount > 1 ? `Ссылок: ${shareLinksCount}` : "Ссылка"}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Actions: kebab menu on mobile, inline on desktop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground sm:hidden"
              onClick={(e) => e.stopPropagation()}
              aria-label="Действия"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться
            </DropdownMenuItem>
            {onMove && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                <FolderInput className="mr-2 h-4 w-4" />
                Переместить
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                <Copy className="mr-2 h-4 w-4" />
                Копировать
              </DropdownMenuItem>
            )}
            {onRename && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Переименовать
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-error focus:text-error"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="hidden items-center gap-1 sm:flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShare(); }}
                className={ACTION_BTN}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Поделиться</TooltipContent>
          </Tooltip>

          {onMove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMove(); }}
                  className={ACTION_BTN}
                >
                  <FolderInput className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Переместить</TooltipContent>
            </Tooltip>
          )}

          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCopy(); }}
                  className={ACTION_BTN}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Копировать</TooltipContent>
            </Tooltip>
          )}

          {onRename && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRename(); }}
                  className={ACTION_BTN}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Переименовать</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className={cn(ACTION_BTN, "text-error hover:bg-error/10 hover:text-error")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Удалить</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
