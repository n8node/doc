"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, FileUp } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface SidebarDropZoneProps {
  maxFileSize?: number;
  disabled?: boolean;
}

export function SidebarDropZone({ maxFileSize, disabled }: SidebarDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const dragCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dispatch = useCallback((files: File[]) => {
    if (files.length > 0) {
      window.dispatchEvent(
        new CustomEvent("files:drop-upload", { detail: { files } })
      );
    }
  }, []);

  const extractFiles = useCallback((e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer?.items ?? []);
    const fromItems = items
      .filter((i) => i.kind === "file")
      .map((i) => i.getAsFile())
      .filter((f): f is File => Boolean(f));
    return fromItems.length > 0 ? fromItems : Array.from(e.dataTransfer?.files ?? []);
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setDragOver(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      dragCountRef.current = 0;
      if (!disabled) dispatch(extractFiles(e));
    },
    [disabled, dispatch, extractFiles]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!disabled && files.length) dispatch(files);
      e.target.value = "";
    },
    [disabled, dispatch]
  );

  const openPicker = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  return (
    <motion.div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
        dragOver
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "border-border/60 hover:border-primary/40 hover:bg-surface2/30",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={onFileSelect}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Animated bg on drag */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-secondary/15"
          />
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-center gap-2 px-4 py-5 text-center">
        <motion.div
          animate={
            dragOver
              ? { scale: 1.15, y: -3, rotate: -5 }
              : { scale: 1, y: 0, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300",
            dragOver
              ? "bg-primary text-white shadow-lg shadow-primary/30"
              : "bg-surface2 text-muted-foreground"
          )}
        >
          {dragOver ? (
            <Cloud className="h-5 w-5" />
          ) : (
            <FileUp className="h-5 w-5" />
          )}
        </motion.div>

        <div className="space-y-0.5">
          <motion.p
            animate={dragOver ? { scale: 1.05 } : { scale: 1 }}
            className="text-xs font-medium text-foreground"
          >
            {dragOver ? "Отпустите" : "Перетащите файлы"}
          </motion.p>
          <p className="text-[10px] text-muted-foreground">
            или нажмите для выбора
          </p>
        </div>

        {maxFileSize && !dragOver && (
          <p className="text-[10px] text-muted-foreground/60">
            до {formatBytes(maxFileSize)}
          </p>
        )}
      </div>

      {/* Pulse ring on drag */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 rounded-2xl"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl"
              style={{ boxShadow: "inset 0 0 0 2px hsl(var(--primary)), 0 0 16px hsl(var(--primary) / 0.25)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
