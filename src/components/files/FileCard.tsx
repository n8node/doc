"use client";

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
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Play,
  FolderOpen,
  Clock,
  Check,
  Link2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  hasShareLink?: boolean;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onPlay?: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  index: number;
}

interface FolderCardProps {
  id: string;
  name: string;
  createdAt: string;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onClick: () => void;
  onShare: () => void;
  onDelete: () => void;
  index: number;
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
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Сегодня";
  }
  if (diffDays === 1) {
    return "Вчера";
  }
  if (diffDays < 7) {
    return `${diffDays} дн. назад`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} нед. назад`;
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function FileCard({
  id,
  name,
  mimeType,
  size,
  createdAt,
  mediaMetadata,
  hasShareLink = false,
  selected,
  onSelect,
  onPlay,
  onDownload,
  onShare,
  onDelete,
  index,
}: FileCardProps) {
  const { icon: Icon, color, bg } = getFileIcon(mimeType);
  const isMedia = mimeType.startsWith("video/") || mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");

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

        {/* Icon */}
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {hasShareLink && (
              <span className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                <Link2 className="h-3 w-3" />
                Публичная ссылка
              </span>
            )}
          </div>
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
          </div>
        </div>

        {/* Quick play button for media */}
        {isMedia && onPlay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary opacity-0 transition-all hover:bg-primary hover:text-white group-hover:opacity-100"
              >
                <Play className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isVideo ? "Смотреть видео" : "Слушать аудио"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-surface2 hover:text-foreground group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isVideo && onPlay && (
              <DropdownMenuItem onClick={onPlay}>
                <Play className="mr-2 h-4 w-4" />
                Смотреть
              </DropdownMenuItem>
            )}
            {isAudio && onPlay && (
              <DropdownMenuItem onClick={onPlay}>
                <Play className="mr-2 h-4 w-4" />
                Слушать
              </DropdownMenuItem>
            )}
            {isMedia && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              Скачать на устройство
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться ссылкой
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-error focus:text-error">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </TooltipProvider>
  );
}

export function FolderCard({
  id,
  name,
  createdAt,
  selected,
  onSelect,
  onClick,
  onShare,
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
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-surface2 hover:text-foreground group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться ссылкой
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }} 
              className="text-error focus:text-error"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить папку
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </TooltipProvider>
  );
}
