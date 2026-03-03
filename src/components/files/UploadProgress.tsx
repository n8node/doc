"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, AlertCircle, Ban, StopCircle } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";
  error?: string;
}

interface UploadProgressProps {
  files: UploadingFile[];
  onCancel?: () => void;
  onRetry?: (id: string) => void;
  onDismiss?: () => void;
}

export function UploadProgress({ files, onCancel, onDismiss }: UploadProgressProps) {
  if (files.length === 0) return null;

  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const cancelledCount = files.filter((f) => f.status === "cancelled").length;
  const totalCount = files.length;
  const isAllDone = completedCount + errorCount + cancelledCount === totalCount;
  const hasCancelled = cancelledCount > 0;

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const uploadedSize = files.reduce((sum, f) => {
    if (f.status === "completed") return sum + f.size;
    if (f.status === "uploading") return sum + (f.size * f.progress) / 100;
    return sum;
  }, 0);
  const overallProgress = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface2/50 px-4 py-3">
          <div className="flex items-center gap-3">
            {!isAllDone ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : hasCancelled && errorCount === 0 ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                <Ban className="h-4 w-4 text-warning" />
              </div>
            ) : errorCount > 0 ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                <AlertCircle className="h-4 w-4 text-warning" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                <Check className="h-4 w-4 text-success" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {!isAllDone
                  ? `Загрузка файлов (${completedCount} из ${totalCount})`
                  : hasCancelled
                  ? `Загрузка отменена`
                  : errorCount > 0
                  ? `Загружено с ошибками`
                  : `Загрузка завершена`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(uploadedSize)} из {formatBytes(totalSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAllDone && onCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="gap-1.5 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Отменить
              </Button>
            )}
            {isAllDone && onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {!isAllDone && (
          <div className="px-4 py-2">
            <div className="relative h-2 overflow-hidden rounded-full bg-surface2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.3 }}
                className="absolute left-0 top-0 h-full rounded-full bg-primary"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{overallProgress}%</span>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="max-h-64 overflow-y-auto">
          {files.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                index < files.length - 1 && "border-b border-border/50"
              )}
            >
              {/* Status icon */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                {file.status === "completed" && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                    <Check className="h-3.5 w-3.5 text-success" />
                  </div>
                )}
                {file.status === "uploading" && (
                  <div className="relative h-6 w-6">
                    <svg className="h-6 w-6 -rotate-90 transform">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="hsl(var(--surface2))"
                        strokeWidth="2"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeDasharray={`${file.progress * 0.628} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
                {file.status === "pending" && (
                  <div className="h-6 w-6 rounded-full border-2 border-border" />
                )}
                {file.status === "cancelled" && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10">
                    <Ban className="h-3.5 w-3.5 text-warning" />
                  </div>
                )}
                {file.status === "error" && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-error/10">
                    <AlertCircle className="h-3.5 w-3.5 text-error" />
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", file.status === "cancelled" ? "text-muted-foreground" : "text-foreground")}>
                  {file.name}
                </p>
                {file.status === "cancelled" && (
                  <p className="truncate text-xs text-warning">Отменено пользователем</p>
                )}
                {file.status === "error" && file.error && (
                  <p className="truncate text-xs text-error">{file.error}</p>
                )}
              </div>

              {/* Size / Progress */}
              <div className="shrink-0 text-right">
                {file.status === "uploading" && (
                  <span className="text-xs font-medium text-primary">{file.progress}%</span>
                )}
                {file.status !== "uploading" && (
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer stats */}
        {isAllDone && (
          <div className="border-t border-border bg-surface2/30 px-4 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {hasCancelled || errorCount > 0
                  ? [
                      completedCount > 0 && `Загружено: ${completedCount}`,
                      cancelledCount > 0 && `Отменено: ${cancelledCount}`,
                      errorCount > 0 && `Ошибок: ${errorCount}`,
                    ].filter(Boolean).join(", ")
                  : `Все ${totalCount} файлов загружены`}
              </span>
              <span className="text-muted-foreground">{formatBytes(uploadedSize)}</span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
