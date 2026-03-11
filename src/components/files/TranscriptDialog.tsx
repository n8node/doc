"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText, FileDown } from "lucide-react";

interface TranscriptDialogProps {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranscriptDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: TranscriptDialogProps) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && fileId) {
      setLoading(true);
      setError(null);
      setTranscript(null);
      fetch(`/api/v1/files/transcribe?fileId=${encodeURIComponent(fileId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.transcriptText != null) {
            setTranscript(String(data.transcriptText));
          } else if (data.error) {
            setError(data.error);
          } else {
            setError("Транскрипт не найден");
          }
        })
        .catch(() => setError("Не удалось загрузить транскрипт"))
        .finally(() => setLoading(false));
    }
  }, [open, fileId]);

  const baseName = fileName.replace(/\.[^.]+$/, "") || "transcript";

  const handleDownload = (format: "txt" | "docx") => {
    const url = `/api/v1/files/${fileId}/transcript?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Транскрипт: {fileName}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {transcript && !loading && (
          <>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-surface2/30 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {transcript}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload("txt")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Скачать TXT
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload("docx")}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                Скачать DOCX
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
