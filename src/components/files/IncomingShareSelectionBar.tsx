"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Unlink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

interface IncomingShareSelectionBarProps {
  selectedCount: number;
  selectedSize: number;
  canDownload: boolean;
  onDownload: () => void;
  onLeaveShare: () => void;
  onClear: () => void;
  leaving?: boolean;
}

export function IncomingShareSelectionBar({
  selectedCount,
  selectedSize,
  canDownload,
  onDownload,
  onLeaveShare,
  onClear,
  leaving,
}: IncomingShareSelectionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 100, x: "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 z-50"
        >
          <div className="flex max-w-[min(100vw-1.5rem,42rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur-lg">
            <div className="flex min-w-0 items-center gap-3 border-r border-border pr-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary">{selectedCount}</span>
              </div>
              <div className="min-w-0">
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

            <div className="flex flex-1 flex-wrap items-center gap-1.5 pl-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onDownload}
                disabled={!canDownload || leaving}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Скачать</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={onLeaveShare}
                disabled={leaving}
                className="gap-2 text-error hover:bg-error/10 hover:text-error"
              >
                {leaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {leaving ? "…" : "Отказаться от доступа"}
                </span>
              </Button>

              <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                disabled={leaving}
                className="h-8 w-8 p-0"
                aria-label="Снять выделение"
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
