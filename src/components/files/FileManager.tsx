"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FolderPlus,
  LayoutGrid,
  LayoutList,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadZone } from "./UploadZone";
import { EmptyState } from "./EmptyState";
import { FileCard, FolderCard } from "./FileCard";
import { UploadProgress, UploadingFile } from "./UploadProgress";
import { SelectionBar } from "./SelectionBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { ShareDialog } from "./ShareDialog";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { formatBytes } from "@/lib/utils";

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

export function FileManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderIdParam = searchParams.get("folderId");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderIdParam || null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: "Мои файлы" }]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const cancelUploadRef = useRef(false);

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

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [maxFileSize, setMaxFileSize] = useState<number>(512 * 1024 * 1024); // 512 MB default

  useEffect(() => {
    fetch("/api/plans/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.maxFileSize && typeof data.maxFileSize === "number") {
          setMaxFileSize(data.maxFileSize);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentFolderId(folderIdParam || null);
  }, [folderIdParam]);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

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

      let bc: Breadcrumb[] = [{ id: null, name: "Мои файлы" }];
      if (currentFolderId) {
        const pathRes = await fetch(`/api/folders/${currentFolderId}/path`);
        if (pathRes.ok) {
          const { path } = await pathRes.json();
          bc = [
            { id: null, name: "Мои файлы" },
            ...(path || []).map((p: { id: string; name: string }) => ({
              id: p.id,
              name: p.name,
            })),
          ];
        }
      }
      setBreadcrumbs(bc);
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      const el = document.createElement(type.startsWith("video/") ? "video" : "audio");
      
      // Таймаут 5 секунд на получение метаданных
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 5000);
      
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(el.duration) ? el.duration : null);
      };
      el.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      el.src = url;
    });
  };

  const handleUpload = async (fileList: FileList) => {
    if (!fileList?.length) return;

    // Конвертируем FileList в массив сразу, т.к. FileList - "живая" коллекция
    const filesArray = Array.from(fileList);
    
    const newUploadingFiles: UploadingFile[] = filesArray.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "pending" as const,
    }));

    cancelUploadRef.current = false;
    setUploadingFiles(newUploadingFiles);
    setShowUploadProgress(true);

    for (let i = 0; i < filesArray.length; i++) {
      if (cancelUploadRef.current) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.status === "pending" ? { ...f, status: "cancelled" as const } : f
          )
        );
        break;
      }

      const file = filesArray[i];
      const uploadId = newUploadingFiles[i].id;

      if (file.size > maxFileSize) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadId
              ? { ...f, status: "error" as const, error: `Превышен лимит ${formatBytes(maxFileSize)}` }
              : f
          )
        );
        toast.error(`${file.name}: превышен лимит ${formatBytes(maxFileSize)}`);
        continue;
      }

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, status: "uploading" as const, progress: 0 } : f))
      );

      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) formData.append("folderId", currentFolderId);

      const mediaType = file.type.startsWith("audio/") || file.type.startsWith("video/");
      if (mediaType) {
        try {
          const dur = await getMediaDuration(file);
          if (dur != null) formData.append("duration", String(dur));
        } catch {}
      }

      try {
        const xhr = new XMLHttpRequest();
        
        await new Promise<void>((resolve) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadingFiles((prev) =>
                prev.map((f) => (f.id === uploadId ? { ...f, progress } : f))
              );
            }
          };

          xhr.onload = () => {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText);
                setUploadingFiles((prev) =>
                  prev.map((f) =>
                    f.id === uploadId ? { ...f, status: "completed" as const, progress: 100 } : f
                  )
                );
                setFiles((prev) => [
                  {
                    id: data.id,
                    name: data.name,
                    mimeType: data.mimeType,
                    size: data.size,
                    folderId: data.folderId,
                    mediaMetadata: data.mediaMetadata ?? null,
                    createdAt: data.createdAt,
                  },
                  ...prev,
                ]);
                resolve();
              } else {
                let errorMsg = "Ошибка загрузки";
                try {
                  const data = JSON.parse(xhr.responseText);
                  errorMsg = data.error || errorMsg;
                } catch {}
                setUploadingFiles((prev) =>
                  prev.map((f) =>
                    f.id === uploadId
                      ? { ...f, status: "error" as const, error: errorMsg }
                      : f
                  )
                );
                resolve();
              }
            } catch {
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadId
                    ? { ...f, status: "error" as const, error: "Ошибка обработки ответа" }
                    : f
                )
              );
              resolve();
            }
          };

          xhr.onerror = () => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === uploadId ? { ...f, status: "error" as const, error: "Сетевая ошибка" } : f
              )
            );
            resolve();
          };

          xhr.ontimeout = () => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === uploadId ? { ...f, status: "error" as const, error: "Превышено время ожидания" } : f
              )
            );
            resolve();
          };

          xhr.timeout = 300000; // 5 минут на файл
          xhr.open("POST", "/api/files/upload");
          xhr.send(formData);
        });
      } catch {}
    }

    setUploadingFiles((currentFiles) => {
      const completed = currentFiles.filter((f) => f.status === "completed").length;
      const errors = currentFiles.filter((f) => f.status === "error").length;
      const cancelled = currentFiles.filter((f) => f.status === "cancelled").length;
      
      if (cancelled > 0) {
        toast.warning(`Загружено: ${completed}, отменено: ${cancelled}${errors > 0 ? `, ошибок: ${errors}` : ""}`);
      } else if (completed > 0 && errors === 0) {
        toast.success(`Загружено файлов: ${completed}`);
      } else if (completed > 0 && errors > 0) {
        toast.warning(`Загружено: ${completed}, ошибок: ${errors}`);
      } else if (errors > 0) {
        toast.error(`Ошибка загрузки ${errors} файлов`);
      }
      
      return currentFiles;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolderId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFolders((prev) => [data, ...prev]);
        toast.success("Папка создана");
        setCreateFolderOpen(false);
        setNewFolderName("");
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка создания папки");
    } finally {
      setCreatingFolder(false);
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
    if (!confirm("Удалить этот файл?")) return;
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFiles((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
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
    if (!confirm("Удалить папку и всё её содержимое?")) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setSelectedFolders((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        if (currentFolderId === id) router.push("/dashboard/files");
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
    const total = fileIds.length + folderIds.length;
    if (total === 0) return;
    if (!confirm(`Удалить ${total} элементов?`)) return;

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

  const handleFileSelect = (id: string, selected: boolean) => {
    setSelectedFiles((prev) => {
      const n = new Set(prev);
      if (selected) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const handleFolderSelect = (id: string, selected: boolean) => {
    setSelectedFolders((prev) => {
      const n = new Set(prev);
      if (selected) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

  const navigateToFolder = (id: string | null) => {
    if (id) {
      router.push(`/dashboard/files?folderId=${id}`);
    } else {
      router.push("/dashboard/files");
    }
  };

  const streamUrl = (id: string) => `/api/files/${id}/stream`;

  const selectedSize = files
    .filter((f) => selectedFiles.has(f.id))
    .reduce((sum, f) => sum + f.size, 0);

  const isEmpty = folders.length === 0 && files.length === 0;
  const isSubfolder = currentFolderId !== null;

  return (
    <>
      <Card className="overflow-hidden">
        {/* Header */}
        <CardHeader className="space-y-4 border-b border-border bg-surface2/30">
          {/* Top row: breadcrumbs + actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Breadcrumbs items={breadcrumbs} onNavigate={navigateToFolder} />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Обновить</span>
              </Button>

              <div className="flex items-center rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === "list" ? "bg-surface2 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === "grid" ? "bg-surface2 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Button size="sm" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                <FolderPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Новая папка</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Upload zone */}
          <UploadZone
            onUpload={handleUpload}
            uploading={uploadingFiles.some((f) => f.status === "uploading")}
            maxFileSize={maxFileSize}
          />

          {/* Upload progress */}
          <AnimatePresence>
            {showUploadProgress && uploadingFiles.length > 0 && (
              <UploadProgress
                files={uploadingFiles}
                onCancel={() => {
                  cancelUploadRef.current = true;
                }}
                onDismiss={() => {
                  setShowUploadProgress(false);
                  setUploadingFiles([]);
                }}
              />
            )}
          </AnimatePresence>

          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl bg-surface2/30 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && isEmpty && (
            <EmptyState
              isSubfolder={isSubfolder}
              onUploadClick={() => uploadInputRef.current?.click()}
              onCreateFolder={() => setCreateFolderOpen(true)}
            />
          )}

          {/* File/folder list */}
          {!loading && !isEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {/* Folders */}
              {folders.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Папки ({folders.length})
                  </p>
                  <div className="space-y-1">
                    {folders.map((folder, index) => (
                      <FolderCard
                        key={folder.id}
                        id={folder.id}
                        name={folder.name}
                        createdAt={folder.createdAt}
                        selected={selectedFolders.has(folder.id)}
                        onSelect={handleFolderSelect}
                        onClick={() => navigateToFolder(folder.id)}
                        onShare={() =>
                          setShareTarget({ type: "FOLDER", id: folder.id, name: folder.name })
                        }
                        onDelete={() => handleDeleteFolder(folder.id)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Файлы ({files.length})
                  </p>
                  <div className="space-y-1">
                    {files.map((file, index) => (
                      <FileCard
                        key={file.id}
                        id={file.id}
                        name={file.name}
                        mimeType={file.mimeType}
                        size={file.size}
                        createdAt={file.createdAt}
                        mediaMetadata={file.mediaMetadata}
                        selected={selectedFiles.has(file.id)}
                        onSelect={handleFileSelect}
                        onPlay={
                          file.mimeType.startsWith("video/") || file.mimeType.startsWith("audio/")
                            ? () =>
                                setMediaModal({
                                  type: file.mimeType.startsWith("video/") ? "video" : "audio",
                                  id: file.id,
                                  name: file.name,
                                })
                            : undefined
                        }
                        onDownload={() => handleDownload(file.id)}
                        onShare={() =>
                          setShareTarget({ type: "FILE", id: file.id, name: file.name })
                        }
                        onDelete={() => handleDeleteFile(file.id)}
                        index={index + folders.length}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input for EmptyState button */}
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Selection bar */}
      <SelectionBar
        selectedCount={selectedFiles.size + selectedFolders.size}
        selectedSize={selectedSize}
        onDownload={
          selectedFiles.size > 0
            ? async () => {
                for (const id of Array.from(selectedFiles)) {
                  await handleDownload(id);
                }
              }
            : undefined
        }
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Создать папку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Название папки</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Новая папка"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateFolderOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? "Создание..." : "Создать"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media modal */}
      {mediaModal && (
        <Dialog open onOpenChange={() => setMediaModal(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{mediaModal.name}</DialogTitle>
            </DialogHeader>
            {mediaModal.type === "video" && <VideoPlayer src={streamUrl(mediaModal.id)} />}
            {mediaModal.type === "audio" && <AudioPlayer src={streamUrl(mediaModal.id)} />}
          </DialogContent>
        </Dialog>
      )}

      {/* Share dialog */}
      {shareTarget && (
        <ShareDialog
          targetType={shareTarget.type}
          targetId={shareTarget.id}
          targetName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </>
  );
}
