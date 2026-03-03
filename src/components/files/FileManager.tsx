"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  File as FileIcon,
  FolderOpen,
  Loader2,
  Music,
  Video,
  MoreVertical,
  Download,
  Trash2,
  Share2,
  Play,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { ShareDialog } from "./ShareDialog";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  mediaMetadata: { durationSeconds?: number } | null;
  createdAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FileManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderIdParam = searchParams.get("folderId");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    folderIdParam || null
  );
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [mediaModal, setMediaModal] = useState<{
    type: "video" | "audio";
    id: string;
    name: string;
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    type: "FILE" | "FOLDER";
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setCurrentFolderId(folderIdParam || null);
  }, [folderIdParam]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fetch(`/api/files?folderId=${currentFolderId || ""}`),
        fetch(`/api/folders?parentId=${currentFolderId || ""}`),
      ]);
      if (filesRes.ok) {
        const d = await filesRes.json();
        setFiles(d.files ?? []);
      }
      if (foldersRes.ok) {
        const d = await foldersRes.json();
        setFolders(d.folders ?? []);
      }
      let bc: Breadcrumb[] = [{ id: null, name: "Файлы" }];
      if (currentFolderId) {
        const pathRes = await fetch(`/api/folders/${currentFolderId}/path`);
        if (pathRes.ok) {
          const { path } = await pathRes.json();
          bc = [{ id: null, name: "Файлы" }, ...(path || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))];
        }
      }
      setBreadcrumbs(bc);
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      if (currentFolderId) formData.append("folderId", currentFolderId);
      const mediaType =
        file.type.startsWith("audio/") || file.type.startsWith("video/");
      if (mediaType) {
        try {
          const dur = await getMediaDuration(file);
          if (dur != null) formData.append("duration", String(dur));
        } catch {
          /* ignore */
        }
      }
      try {
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) {
          ok++;
          setFiles((prev) => [
            { id: data.id, name: data.name, mimeType: data.mimeType, size: data.size, folderId: data.folderId, mediaMetadata: data.mediaMetadata ?? null, createdAt: data.createdAt },
            ...prev,
          ]);
        } else toast.error(data.error || `Ошибка: ${file.name}`);
      } catch {
        toast.error(`Ошибка: ${file.name}`);
      }
    }
    if (ok > 0) toast.success(`Загружено: ${ok}`);
    setUploading(false);
  };

  const handleCreateFolder = async () => {
    const name = prompt("Имя папки");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId: currentFolderId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFolders((prev) => [...prev, data]);
        toast.success("Папка создана");
      } else toast.error(data.error || "Ошибка");
    } catch {
      toast.error("Ошибка создания папки");
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/download`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, "_blank");
      else toast.error("Ошибка скачивания");
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm("Удалить файл?")) return;
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        toast.success("Файл удалён");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Удалить папку и всё содержимое?")) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (currentFolderId === id) router.push("/dashboard/files");
        loadData();
        toast.success("Папка удалена");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleBulkDelete = async () => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;
    if (!confirm(`Удалить ${fileIds.length + folderIds.length} элементов?`)) return;
    for (const id of fileIds) {
      await fetch(`/api/files/${id}`, { method: "DELETE" });
    }
    for (const id of folderIds) {
      await fetch(`/api/folders/${id}`, { method: "DELETE" });
    }
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    loadData();
    toast.success("Удалено");
  };

  const streamUrl = (id: string) => `/api/files/${id}/stream`;

  const fileIcon = (mime: string) => {
    if (mime.startsWith("video/")) return <Video className="h-5 w-5 text-primary" />;
    if (mime.startsWith("audio/")) return <Music className="h-5 w-5 text-primary" />;
    return <FileIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const isVideo = (mime: string) => mime.startsWith("video/");
  const isAudio = (mime: string) => mime.startsWith("audio/");

  const hasSelection = selectedFiles.size > 0 || selectedFolders.size > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {breadcrumbs.map((b, i) => (
            <span key={b.id ?? "root"}>
              <button
                type="button"
                onClick={() =>
                  router.push(b.id ? `/dashboard/files?folderId=${b.id}` : "/dashboard/files")
                }
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {b.name}
              </button>
              {i < breadcrumbs.length - 1 && (
                <span className="mx-1 text-muted-foreground">/</span>
              )}
            </span>
          ))}
        </div>
        <Button size="sm" onClick={handleCreateFolder}>
          Новая папка
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            "relative flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-surface2/50 hover:bg-surface2"
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {hasSelection && (
          <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              Выбрано: {selectedFiles.size + selectedFolders.size}
            </span>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              Удалить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSelectedFiles(new Set()); setSelectedFolders(new Set()); }}>
              Снять выбор
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        ) : (
          <ul className="space-y-1">
            {folders.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface2/50"
              >
                <input
                  type="checkbox"
                  checked={selectedFolders.has(f.id)}
                  onChange={(e) => {
                    setSelectedFolders((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(f.id);
                      else n.delete(f.id);
                      return n;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => router.push(`/dashboard/files?folderId=${f.id}`)}
                >
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <span className="font-medium">{f.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="rounded p-1 hover:bg-surface2">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShareTarget({ type: "FOLDER", id: f.id, name: f.name })}>
                      <Share2 className="mr-2 h-4 w-4" /> Поделиться
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteFolder(f.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface2/50"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.id)}
                  onChange={(e) => {
                    setSelectedFiles((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(file.id);
                      else n.delete(file.id);
                      return n;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {fileIcon(file.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                    {file.mediaMetadata?.durationSeconds != null &&
                      ` · ${formatDuration(file.mediaMetadata.durationSeconds)}`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="rounded p-1 hover:bg-surface2">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isVideo(file.mimeType) && (
                      <DropdownMenuItem onClick={() => setMediaModal({ type: "video", id: file.id, name: file.name })}>
                        <Play className="mr-2 h-4 w-4" /> Смотреть
                      </DropdownMenuItem>
                    )}
                    {isAudio(file.mimeType) && (
                      <DropdownMenuItem onClick={() => setMediaModal({ type: "audio", id: file.id, name: file.name })}>
                        <Play className="mr-2 h-4 w-4" /> Слушать
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDownload(file.id)}>
                      <Download className="mr-2 h-4 w-4" /> Скачать
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShareTarget({ type: "FILE", id: file.id, name: file.name })}>
                      <Share2 className="mr-2 h-4 w-4" /> Поделиться
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteFile(file.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}

        {folders.length === 0 && files.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Папка пуста
          </p>
        )}
      </CardContent>

      {mediaModal && (
        <Dialog open onOpenChange={() => setMediaModal(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{mediaModal.name}</DialogTitle>
            </DialogHeader>
            {mediaModal.type === "video" && (
              <VideoPlayer src={streamUrl(mediaModal.id)} />
            )}
            {mediaModal.type === "audio" && (
              <AudioPlayer src={streamUrl(mediaModal.id)} />
            )}
          </DialogContent>
        </Dialog>
      )}

      {shareTarget && (
        <ShareDialog
          targetType={shareTarget.type}
          targetId={shareTarget.id}
          targetName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </Card>
  );
}
