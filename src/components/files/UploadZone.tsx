"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Cloud, FileImage, FileVideo, FileAudio, FileText, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  uploading: boolean;
  disabled?: boolean;
  maxFileSize?: number;
  storageUsed?: number | null;
  storageQuota?: number | null;
}

export function UploadZone({
  onUpload,
  uploading,
  disabled,
  maxFileSize,
  storageUsed,
  storageQuota,
}: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dragCountRef] = useState({ current: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    setDragOver(true);
  }, [dragCountRef]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setDragOver(false);
  }, [dragCountRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const extractDroppedFiles = useCallback((e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer?.items ?? []);
    const filesFromItems = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (filesFromItems.length > 0) {
      return filesFromItems;
    }

    return Array.from(e.dataTransfer?.files ?? []);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      dragCountRef.current = 0;
      const droppedFiles = extractDroppedFiles(e);
      if (droppedFiles.length && !uploading && !disabled) {
        onUpload(droppedFiles);
      }
    },
    [onUpload, uploading, disabled, dragCountRef, extractDroppedFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files ?? []);
      if (selectedFiles.length && !uploading && !disabled) {
        onUpload(selectedFiles);
      }
      e.target.value = "";
    },
    [onUpload, uploading, disabled]
  );

  const openFilePicker = useCallback(() => {
    if (uploading || disabled) return;
    fileInputRef.current?.click();
  }, [uploading, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="button"
      tabIndex={uploading || disabled ? -1 : 0}
      aria-disabled={uploading || disabled}
      onClick={openFilePicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
        dragOver
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50 hover:bg-surface2/30",
        uploading && "pointer-events-none opacity-60",
        disabled && "pointer-events-none opacity-40",
        !uploading && !disabled && "cursor-pointer"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileSelect}
        disabled={uploading || disabled}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="relative px-6 py-10">
        {/* Animated background pattern on drag */}
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
              <motion.div
                animate={{
                  backgroundPosition: ["0% 0%", "100% 100%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at center, hsl(var(--primary)) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex flex-col items-center gap-4 text-center">
          {/* Main icon */}
          <motion.div
            animate={dragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300",
              dragOver ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-surface2 text-muted-foreground"
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : dragOver ? (
              <Cloud className="h-8 w-8" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </motion.div>

          {/* Text */}
          <div className="space-y-2">
            <motion.p
              animate={dragOver ? { scale: 1.05 } : { scale: 1 }}
              className="text-lg font-semibold text-foreground"
            >
              {uploading
                ? "Загрузка файлов..."
                : dragOver
                ? "Отпустите для загрузки"
                : "Перетащите файлы сюда"}
            </motion.p>
            <p className="text-sm text-muted-foreground">
              {uploading
                ? "Пожалуйста, подождите"
                : "или нажмите для выбора файлов"}
            </p>
          </div>

          {/* Supported formats */}
          {!uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap items-center justify-center gap-3 pt-2"
            >
              <div className="flex items-center gap-1.5 rounded-full bg-surface2/80 px-3 py-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>Документы</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-surface2/80 px-3 py-1.5 text-xs text-muted-foreground">
                <FileImage className="h-3.5 w-3.5" />
                <span>Изображения</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-surface2/80 px-3 py-1.5 text-xs text-muted-foreground">
                <FileVideo className="h-3.5 w-3.5" />
                <span>Видео</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-surface2/80 px-3 py-1.5 text-xs text-muted-foreground">
                <FileAudio className="h-3.5 w-3.5" />
                <span>Аудио</span>
              </div>
            </motion.div>
          )}

          {/* Size limit hint */}
          {!uploading && maxFileSize && (
            <p className="text-xs text-muted-foreground/70">
              Максимальный размер файла: {formatBytes(maxFileSize)}
            </p>
          )}

          {!uploading &&
            typeof storageUsed === "number" &&
            typeof storageQuota === "number" &&
            storageQuota > 0 && (
              <p className="text-xs text-muted-foreground/70">
                Доступно сейчас: {formatBytes(Math.max(storageQuota - storageUsed, 0))} из{" "}
                {formatBytes(storageQuota)}
              </p>
            )}
        </div>
      </div>

      {/* Pulsing border animation on drag */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              boxShadow: "inset 0 0 0 2px hsl(var(--primary))",
            }}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: "0 0 20px hsl(var(--primary) / 0.3)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
