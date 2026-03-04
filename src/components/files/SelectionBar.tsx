"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Trash2, FolderInput, Copy, BrainCircuit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

interface SelectionBarProps {
  selectedCount: number;
  selectedSize: number;
  onDownload?: () => void;
  onMove?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onDelete: () => void;
  onClear: () => void;
  onAiAnalyze?: () => void;
  aiAnalyzing?: boolean;
}

export function SelectionBar({
  selectedCount,
  selectedSize,
  onDownload,
  onMove,
  onCopy,
  onDelete,
  onClear,
  onAiAnalyze,
  aiAnalyzing,
}: SelectionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur-lg">
            {/* Selection info */}
            <div className="flex items-center gap-3 border-r border-border pr-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary">{selectedCount}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedCount === 1
                    ? "Выбран 1 элемент"
                    : selectedCount < 5
                    ? `Выбрано ${selectedCount} элемента`
                    : `Выбрано ${selectedCount} элементов`}
                </p>
                {selectedSize > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Общий размер: {formatBytes(selectedSize)}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 pl-2">
              {onDownload && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDownload}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Скачать</span>
                </Button>
              )}

              {onMove && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onMove}
                  className="gap-2"
                >
                  <FolderInput className="h-4 w-4" />
                  <span className="hidden sm:inline">Переместить</span>
                </Button>
              )}

              {onCopy && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCopy}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Копировать</span>
                </Button>
              )}

              {onAiAnalyze && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onAiAnalyze}
                  disabled={aiAnalyzing}
                  className="gap-2 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                >
                  {aiAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BrainCircuit className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {aiAnalyzing ? "Анализ..." : "AI Анализ"}
                  </span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="gap-2 text-error hover:bg-error/10 hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Удалить</span>
              </Button>

              <div className="mx-1 h-6 w-px bg-border" />

              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
