"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Download,
  Database,
  Info,
  Loader2,
  Check,
  FileJson,
  FileCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExportFormat = "sql" | "supabase" | "qdrant";

const formatOptions: { value: ExportFormat; label: string; icon: typeof Database; description: string }[] = [
  { value: "sql", label: "PostgreSQL", icon: Database, description: "CREATE TABLE + INSERT для pgvector" },
  { value: "supabase", label: "Supabase", icon: FileCode, description: "Тот же SQL с пометкой Supabase" },
  { value: "qdrant", label: "Qdrant", icon: FileJson, description: "JSON для upsert в Qdrant" },
];

interface ExportDialogProps {
  collectionId: string;
  collectionName: string;
  hasEmbeddings: boolean;
  onClose: () => void;
}

export function ExportDialog({
  collectionId,
  collectionName: _collectionName,
  hasEmbeddings,
  onClose,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("sql");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!hasEmbeddings) {
      toast.error("Нет эмбеддингов для экспорта");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/rag/collections/${collectionId}/export?format=${format}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка экспорта");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `collection_${collectionId}_${format}.${format === "qdrant" ? "json" : "sql"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Файл скачан");
      onClose();
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setLoading(false);
    }
  };

  const needsPgvector = format === "sql" || format === "supabase";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md min-w-0 overflow-hidden p-0">
        {/* Header */}
        <div className="border-b border-border bg-surface2/50 px-6 py-4">
          <DialogHeader>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-left">Выгрузка</DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6"
        >
          <div className="space-y-6">
            {!hasEmbeddings ? (
              <p className="text-sm text-muted-foreground">
                В коллекции нет эмбеддингов. Сначала векторизуйте файлы.
              </p>
            ) : (
              <>
                {/* Format selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Формат</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {formatOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormat(opt.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200",
                          format === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <opt.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">{opt.label}</span>
                          <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                        {format === opt.value && (
                          <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                  {needsPgvector && (
                    <p className="flex items-start gap-2 rounded-lg bg-surface2/50 p-2.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Для PostgreSQL и Supabase нужен pgvector. Выполните: <code className="rounded bg-muted px-1">CREATE EXTENSION IF NOT EXISTS vector;</code>
                    </p>
                  )}
                </div>

                {/* Download button */}
                <Button
                  onClick={handleDownload}
                  disabled={loading}
                  className="w-full gap-2"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Выгрузка...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Скачать
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
