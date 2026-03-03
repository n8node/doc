"use client";

import { motion } from "framer-motion";
import { FolderOpen, Upload, FolderPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUploadClick: () => void;
  onCreateFolder: () => void;
  isSubfolder?: boolean;
}

export function EmptyState({ onUploadClick, onCreateFolder, isSubfolder }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface2/30 px-8 py-16"
    >
      {/* Animated folder icon */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative mb-6"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20">
          <FolderOpen className="h-12 w-12 text-primary" />
        </div>
        
        {/* Decorative sparkles */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -right-2 -top-2"
        >
          <Sparkles className="h-5 w-5 text-warning" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {isSubfolder ? "Папка пуста" : "Здесь пока ничего нет"}
      </h3>

      {/* Description */}
      <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
        {isSubfolder
          ? "Загрузите файлы или создайте подпапку, чтобы организовать ваши данные"
          : "Загрузите ваши первые файлы или создайте папку, чтобы начать работу с облачным хранилищем"}
      </p>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={onUploadClick}
          className="gap-2 shadow-lg shadow-primary/20"
        >
          <Upload className="h-4 w-4" />
          Загрузить файлы
        </Button>
        
        <Button
          variant="outline"
          onClick={onCreateFolder}
          className="gap-2"
        >
          <FolderPlus className="h-4 w-4" />
          Создать папку
        </Button>
      </div>

      {/* Helpful tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 grid max-w-md gap-3 text-xs text-muted-foreground"
      >
        <div className="flex items-start gap-2 rounded-lg bg-surface2/50 p-3">
          <span className="text-base">💡</span>
          <span>Вы можете перетаскивать файлы прямо в браузер для быстрой загрузки</span>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-surface2/50 p-3">
          <span className="text-base">🔗</span>
          <span>Делитесь файлами по ссылке — получатель скачает без регистрации</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
