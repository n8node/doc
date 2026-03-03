"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Link2,
  Clock,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Loader2,
  FileIcon,
  FolderOpen,
  Mail,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
  targetType: "FILE" | "FOLDER";
  targetId: string;
  targetName: string;
  onClose: () => void;
}

const expiryOptions = [
  { value: "1", label: "1 день", description: "Ссылка истечёт завтра" },
  { value: "7", label: "7 дней", description: "Ссылка истечёт через неделю" },
  { value: "30", label: "30 дней", description: "Ссылка истечёт через месяц" },
  { value: "0", label: "Бессрочно", description: "Ссылка будет работать всегда" },
];

export function ShareDialog({
  targetType,
  targetId,
  targetName,
  onClose,
}: ShareDialogProps) {
  const [expiresIn, setExpiresIn] = useState("7");
  const [oneTime, setOneTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    try {
      let expiresAt: string | null = null;
      if (expiresIn && expiresIn !== "0") {
        const d = new Date();
        const days = parseInt(expiresIn, 10) || 7;
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
        setExpiryDate(
          d.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        );
      } else {
        setExpiryDate(null);
      }
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          fileId: targetType === "FILE" ? targetId : undefined,
          folderId: targetType === "FOLDER" ? targetId : undefined,
          expiresAt,
          oneTime,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setUrl(data.url);
        toast.success("Ссылка создана");
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Ссылка скопирована в буфер обмена");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMailShare = () => {
    if (url) {
      const subject = encodeURIComponent(`Доступ к ${targetType === "FILE" ? "файлу" : "папке"}: ${targetName}`);
      const body = encodeURIComponent(`Привет!\n\nДелюсь ${targetType === "FILE" ? "файлом" : "папкой"} "${targetName}":\n${url}\n\nСсылка ${expiryDate ? `действует до ${expiryDate}` : "бессрочная"}.`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Header */}
        <div className="border-b border-border bg-surface2/50 px-6 py-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-left">Поделиться</DialogTitle>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {targetType === "FILE" ? (
                    <FileIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5" />
                  )}
                  <span className="truncate">{targetName}</span>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <AnimatePresence mode="wait">
          {!url ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              <div className="space-y-6">
                {/* Expiry selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Срок действия</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {expiryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExpiresIn(option.value)}
                        className={cn(
                          "rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200",
                          expiresIn === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="flex items-start gap-2 rounded-lg bg-surface2/50 p-2.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {expiryOptions.find((o) => o.value === expiresIn)?.description}
                  </p>
                </div>

                {/* One-time toggle */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOneTime(!oneTime)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                      oneTime
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                        oneTime
                          ? "border-primary bg-primary"
                          : "border-border"
                      )}
                    >
                      {oneTime && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Одноразовая ссылка</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ссылка станет недействительной после первого скачивания. 
                        Подходит для конфиденциальных файлов.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Create button */}
                <Button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full gap-2"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Создание ссылки...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Создать ссылку
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6"
            >
              <div className="space-y-5">
                {/* Success message */}
                <div className="flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10"
                  >
                    <Check className="h-7 w-7 text-success" />
                  </motion.div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Ссылка готова!</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Поделитесь ею с теми, кому хотите дать доступ
                  </p>
                </div>

                {/* URL field */}
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    className="w-full rounded-xl border border-border bg-surface2/50 px-4 py-3 pr-24 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                      copied
                        ? "bg-success/10 text-success"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Готово
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="h-3.5 w-3.5" />
                        Копировать
                      </span>
                    )}
                  </button>
                </div>

                {/* Expiry info */}
                {expiryDate && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Действует до {expiryDate}</span>
                  </div>
                )}
                {oneTime && (
                  <div className="flex items-center justify-center gap-2 text-sm text-warning">
                    <Shield className="h-4 w-4" />
                    <span>Одноразовая ссылка</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleMailShare}
                  >
                    <Mail className="h-4 w-4" />
                    Отправить на почту
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
