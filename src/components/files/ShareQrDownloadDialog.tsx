"use client";

import { useEffect, useState } from "react";
import { QrCode, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getQrPreviewDataUrl,
  downloadQrPng,
  downloadQrSvg,
  downloadQrEps,
  downloadQrPdf,
} from "@/lib/qr-share-download";

const FORMATS = [
  {
    key: "png",
    label: "PNG",
    hint: "Растровое изображение",
    ext: "png",
  },
  {
    key: "svg",
    label: "SVG",
    hint: "Векторное изображение",
    ext: "svg",
  },
  {
    key: "eps",
    label: "EPS",
    hint: "Вектор для печати",
    ext: "eps",
  },
  {
    key: "pdf",
    label: "PDF",
    hint: "Документ",
    ext: "pdf",
  },
] as const;

interface ShareQrDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
}

export function ShareQrDownloadDialog({
  open,
  onOpenChange,
  shareUrl,
}: ShareQrDownloadDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shareUrl) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void getQrPreviewDataUrl(shareUrl)
      .then((dataUrl) => {
        if (!cancelled) setPreview(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  const baseName = "qr-public-link";

  const handleDownload = async (key: (typeof FORMATS)[number]["key"]) => {
    setBusy(key);
    try {
      const name = `${baseName}.${FORMATS.find((f) => f.key === key)?.ext ?? "png"}`;
      switch (key) {
        case "png":
          await downloadQrPng(shareUrl, name);
          break;
        case "svg":
          await downloadQrSvg(shareUrl, name);
          break;
        case "eps":
          downloadQrEps(shareUrl, name);
          break;
        case "pdf":
          await downloadQrPdf(shareUrl, name);
          break;
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-left text-base font-semibold">
              Скачать QR-код
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl border-2 border-border bg-muted/30 p-4",
              "mx-auto sm:mx-0",
            )}
          >
            {loadingPreview ? (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-muted-foreground">
                Загрузка…
              </div>
            ) : preview ? (
              <img
                src={preview}
                alt=""
                width={220}
                height={220}
                className="h-[220px] w-[220px] object-contain"
              />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                Не удалось построить превью
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {FORMATS.map((f) => (
              <Button
                key={f.key}
                type="button"
                variant="outline"
                className="h-auto flex-col items-stretch gap-0.5 py-3 text-left sm:items-start"
                disabled={!shareUrl || busy !== null}
                onClick={() => void handleDownload(f.key)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{f.label}</span>
                  {busy === f.key ? (
                    <span className="text-xs text-muted-foreground">…</span>
                  ) : null}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {f.hint}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
