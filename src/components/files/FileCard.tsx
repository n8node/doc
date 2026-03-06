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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatBytes } from "@/lib/utils";

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
  onViewTranscript?: () => void;
  onChat?: () => void;
  onDelete: () => void;
  index: number;
  isProcessable?: boolean;
  isAnalyzing?: boolean;
  analyzeError?: string;
  isTranscribable?: boolean;
  isTranscribing?: boolean;
  transcribeError?: string;
  transcribeEstimateMinutes?: number;
}

interface FolderCardProps {
  id: string;
  name: string;
  createdAt: string;
  hasShareLink?: boolean;
  shareLinksCount?: number;
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
  onViewTranscript,
  onChat,
  onDelete,
  index,
  isProcessable = false,
  isAnalyzing,
  analyzeError,
  isTranscribable = false,
  isTranscribing,
  transcribeEstimateMinutes,
  transcribeError,
}: FileCardProps) {
  const { icon: Icon, color, bg } = getFileIcon(mimeType);
  const [thumbnailError, setThumbnailError] = useState(false);
  const showThumbnail = isImageFile(mimeType, name) && !thumbnailError;
  const isMedia = mimeType.startsWith("video/") || mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");
  const isProcessed = !!aiMetadata?.processedAt;
  const isTranscribed = !!aiMetadata?.transcriptProcessedAt;

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
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(createdAt)}
            </span>
            {isProcessable && isAnalyzing && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-500 animate-pulse" title="Анализируется...">
                  <BrainCircuit className="h-3 w-3" />
                  Анализ...
                </span>
              </>
            )}
            {isProcessable && analyzeError && !isAnalyzing && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-red-500" title={analyzeError}>
                  <BrainCircuit className="h-3 w-3" />
                  Ошибка
                </span>
              </>
            )}
            {isProcessable && isProcessed && !isAnalyzing && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 font-medium" title="Документ обработан AI">
                  <BrainCircuit className="h-3 w-3" />
                  AI
                </span>
              </>
            )}
            {isTranscribable && isTranscribing && (
              <>
                <span>•</span>
                <span
                  className="flex items-center gap-1 text-amber-500 animate-pulse"
                  title={
                    transcribeEstimateMinutes
                      ? `Транскрибируется... (~${transcribeEstimateMinutes} мин)`
                      : "Транскрибируется..."
                  }
                >
                  <Mic2 className="h-3 w-3" />
                  Транскрипция...
                </span>
              </>
            )}
            {isTranscribable && transcribeError && !isTranscribing && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-red-500" title={transcribeError}>
                  <Mic2 className="h-3 w-3" />
                  Ошибка
                </span>
              </>
            )}
            {isTranscribable && isTranscribed && !isTranscribing && (
              <>
                <span>•</span>
                {onViewTranscript ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTranscript();
                    }}
                    className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium transition-colors hover:bg-amber-500/20"
                    title="Просмотр транскрипта"
                  >
                    <Mic2 className="h-3 w-3" />
                    Транскрипт
                  </button>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium" title="Транскрипт готов">
                    <Mic2 className="h-3 w-3" />
                    Транскрипт
                  </span>
                )}
              </>
            )}
            {hasShareLink && (
              <>
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
              </>
            )}
            {onChat && isProcessed && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Inline actions */}
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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

          {onProcess && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProcess();
                  }}
                  className={cn(ACTION_BTN, "text-emerald-500 hover:bg-emerald-500/10")}
                >
                  <ScanSearch className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Анализ документа</TooltipContent>
            </Tooltip>
          )}

          {onTranscribe && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTranscribe();
                  }}
                  className={cn(ACTION_BTN, "text-amber-500 hover:bg-amber-500/10")}
                >
                  <Mic2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Транскрибировать</TooltipContent>
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
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(createdAt)}
            </span>
            {hasShareLink && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Inline actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
