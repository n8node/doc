"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Cloud, FileImage, FileVideo, FileAudio, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  uploading: boolean;
  disabled?: boolean;
}

export function UploadZone({ onUpload, uploading, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dragCountRef] = useState({ current: 0 });

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
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      dragCountRef.current = 0;
      if (e.dataTransfer.files?.length && !uploading && !disabled) {
        onUpload(e.dataTransfer.files);
      }
    },
    [onUpload, uploading, disabled, dragCountRef]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length && !uploading && !disabled) {
        onUpload(e.target.files);
      }
      e.target.value = "";
    },
    [onUpload, uploading, disabled]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
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
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <input
        type="file"
        multiple
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
        onChange={handleFileSelect}
        disabled={uploading || disabled}
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
          {!uploading && (
            <p className="text-xs text-muted-foreground/70">
              Максимальный размер файла: 2 ГБ
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
