"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, FileUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarDropZone } from "@/components/files/SidebarDropZone";
import { useCompactSidebarViewport } from "@/hooks/useCompactSidebarViewport";

interface SidebarUploadDockProps {
  onUploadClick: () => void;
}

export function SidebarUploadDock({ onUploadClick }: SidebarUploadDockProps) {
  const compact = useCompactSidebarViewport();
  const [dropZoneOpen, setDropZoneOpen] = useState(false);

  useEffect(() => {
    if (compact) setDropZoneOpen(false);
  }, [compact]);

  const panelOpen = !compact || dropZoneOpen;
  const toggleDropZone = useCallback(() => {
    if (compact) setDropZoneOpen((o) => !o);
  }, [compact]);

  return (
    <div className="space-y-3 px-4 pt-4">
      <button
        type="button"
        onClick={onUploadClick}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <Upload className="h-4 w-4" />
        Загрузить
      </button>

      <motion.div
        initial={false}
        animate={
          compact
            ? {
                height: panelOpen ? "auto" : 0,
                opacity: panelOpen ? 1 : 0,
              }
            : { height: "auto", opacity: 1 }
        }
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={cn(
          "overflow-hidden",
          compact && !panelOpen && "pointer-events-none",
        )}
      >
        <SidebarDropZone />
      </motion.div>

      {compact && (
        <button
          type="button"
          onClick={toggleDropZone}
          aria-expanded={dropZoneOpen}
          className="flex w-full items-center gap-2 rounded-xl border border-border/50 bg-surface2/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-surface2/45 hover:text-foreground"
        >
          <FileUp className="h-3.5 w-3.5 shrink-0 text-primary/80" />
          <span className="min-w-0 flex-1 truncate">
            Перетаскивание файлов
          </span>
          {dropZoneOpen ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
