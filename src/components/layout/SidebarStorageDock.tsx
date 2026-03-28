"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { useCompactSidebarViewport } from "@/hooks/useCompactSidebarViewport";

export function SidebarStorageDock() {
  const compact = useCompactSidebarViewport();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (compact) setExpanded(false);
  }, [compact]);

  const panelOpen = !compact || expanded;
  const toggle = useCallback(() => {
    if (compact) setExpanded((e) => !e);
  }, [compact]);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col",
        compact && "border-t border-border/70",
      )}
    >
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
        <div className={cn("px-4", compact ? "pb-2 pt-2" : "pb-4")}>
          <StorageWidget />
        </div>
      </motion.div>

      {compact && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-surface2/50 hover:text-foreground"
        >
          <HardDrive className="h-4 w-4 shrink-0 text-primary/80" />
          <span className="min-w-0 flex-1 truncate">Тариф и хранилище</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
