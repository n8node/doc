"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Upload, File as FileIcon, Loader2, Music, Video } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  folderId: string | null;
  mediaMetadata: { durationSeconds?: number } | null;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast.error("Не удалось загрузить список файлов");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getMediaDuration = async (file: globalThis.File): Promise<number | null> => {
    const type = file.type || "";
    if (!type.startsWith("audio/") && !type.startsWith("video/")) return null;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const el = document.createElement(
        type.startsWith("video/") ? "video" : "audio"
      );
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(el.duration) ? el.duration : null);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      el.src = url;
    });
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length || uploading) return;
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append("file", file);
      const mediaType = file.type.startsWith("audio/") || file.type.startsWith("video/");
      if (mediaType) {
        try {
          const dur = await getMediaDuration(file);
          if (dur != null) formData.append("duration", String(dur));
        } catch {
          /* ignore */
        }
      }
      try {
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          ok++;
          setFiles((prev) => [
            {
              id: data.id,
              name: data.name,
              mimeType: data.mimeType,
              size: data.size,
              s3Key: data.s3Key,
              folderId: data.folderId,
              mediaMetadata: data.mediaMetadata ?? null,
              createdAt: data.createdAt,
            },
            ...prev,
          ]);
        } else {
          toast.error(data.error || `Ошибка загрузки: ${file.name}`);
        }
      } catch {
        toast.error(`Ошибка загрузки: ${file.name}`);
      }
    }
    if (ok > 0) toast.success(`Загружено файлов: ${ok}`);
    setUploading(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const fileIcon = (mime: string) => {
    if (mime.startsWith("video/")) return <Video className="h-5 w-5 text-primary" />;
    if (mime.startsWith("audio/")) return <Music className="h-5 w-5 text-primary" />;
    return <FileIcon className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold">Файлы</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-surface2/50 hover:border-primary/50 hover:bg-surface2"
          )}
        >
          <input
            type="file"
            multiple
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">
                Загрузка...
              </p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Перетащите файлы сюда или нажмите для выбора
              </p>
              <p className="text-xs text-muted-foreground">
                Поддерживаются все типы файлов. Для видео и аудио сохраняется длительность.
              </p>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка списка...
          </div>
        ) : files.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Нет загруженных файлов
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-surface2/50"
              >
                {fileIcon(f.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.size)}
                    {f.mediaMetadata?.durationSeconds != null && (
                      <> · {formatDuration(f.mediaMetadata.durationSeconds)}</>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
