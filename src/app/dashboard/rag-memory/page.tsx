"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Loader2,
  Plus,
  Zap,
  FolderOpen,
  FileText,
  Trash2,
  MoreVertical,
  Download,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExportDialog } from "@/components/rag/ExportDialog";

interface CollectionFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  hasEmbedding: boolean;
}

interface Collection {
  id: string;
  name: string;
  folderId: string | null;
  folder: { id: string; name: string } | null;
  filesCount: number;
  processableCount?: number;
  filesWithEmbeddings: number;
  files: CollectionFile[];
  createdAt: string;
  updatedAt: string;
}

interface FolderOption {
  id: string;
  name: string;
  parentId: string | null;
}

interface FileOption {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export default function RagMemoryPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSource, setCreateSource] = useState<"folder" | "files">("folder");
  const [createFolderId, setCreateFolderId] = useState<string>("");
  const [createFileIds, setCreateFileIds] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [files, setFiles] = useState<FileOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [vectorizingId, setVectorizingId] = useState<string | null>(null);
  const [vectorizeState, setVectorizeState] = useState<{
    stage: "fetching_files" | "analyzing_formats" | "ready" | "vectorizing";
    message: string;
    progressPercent: number;
    processed?: number;
    total?: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [exportCollectionId, setExportCollectionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shortenId = (id: string, maxLen = 24) => {
    if (id.length <= maxLen) return id;
    return `${id.slice(0, 10)}…${id.slice(-8)}`;
  };

  const handleCopyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("ID коллекции скопирован");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/rag/collections", { credentials: "include" });
      const data = await res.json();
      setCollections(Array.isArray(data.collections) ? data.collections : []);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/v1/folders?scope=all", { credentials: "include" });
      const data = await res.json();
      setFolders(Array.isArray(data.folders) ? data.folders : []);
    } catch {
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/v1/files?scope=all", { credentials: "include" });
      const data = await res.json();
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch {
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (createOpen) {
      if (createSource === "folder") loadFolders();
      else loadFiles();
    }
  }, [createOpen, createSource, loadFolders, loadFiles]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("Введите название");
      return;
    }
    if (createSource === "folder" && !createFolderId) {
      toast.error("Выберите папку");
      return;
    }
    if (createSource === "files" && createFileIds.size === 0) {
      toast.error("Выберите хотя бы один файл");
      return;
    }

    setCreating(true);
    try {
      const body: { name: string; folderId?: string; fileIds?: string[] } = { name };
      if (createSource === "folder") body.folderId = createFolderId;
      else body.fileIds = Array.from(createFileIds);

      const res = await fetch("/api/v1/rag/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Ошибка создания");
        return;
      }

      toast.success("RAG-память создана");
      setCreateOpen(false);
      setCreateName("");
      setCreateFolderId("");
      setCreateFileIds(new Set());
      loadCollections();
    } catch {
      toast.error("Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleVectorize = async (collectionId: string) => {
    const coll = collections.find((x) => x.id === collectionId);
    const filesCount = coll?.filesCount ?? 0;
    const processableCount = coll?.processableCount ?? coll?.filesCount ?? 0;

    setVectorizingId(collectionId);
    setVectorizeState({
      stage: "fetching_files",
      message: "Получаем файлы…",
      progressPercent: 0,
    });

    const stageTimeouts: ReturnType<typeof setTimeout>[] = [];
    stageTimeouts.push(
      setTimeout(() => {
        setVectorizeState((s) =>
          s ? { ...s, message: `Получаем файлы (${filesCount})`, progressPercent: 15 } : null
        );
      }, 400)
    );
    stageTimeouts.push(
      setTimeout(() => {
        setVectorizeState((s) =>
          s ? { ...s, message: "Анализируем форматы файлов", progressPercent: 30 } : null
        );
      }, 800)
    );
    stageTimeouts.push(
      setTimeout(() => {
        setVectorizeState((s) =>
          s
            ? { ...s, message: `Получено ${processableCount} файлов пригодных к векторизации`, progressPercent: 40 }
            : null
        );
      }, 1200)
    );

    try {
      const res = await fetch(`/api/v1/rag/collections/${collectionId}/vectorize`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Ошибка векторизации");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        toast.error("Ошибка чтения ответа");
        return;
      }

      let buffer = "";
      let finalData: { succeeded?: number; total?: number; failed?: number } = {};
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as {
              type: string;
              stage?: string;
              filesCount?: number;
              processableCount?: number;
              total?: number;
              processed?: number;
              remaining?: number;
              succeeded?: number;
              failed?: number;
            };
            if (ev.type === "progress" && ev.processed != null && ev.total != null) {
              const pct = ev.total > 0 ? 40 + (60 * ev.processed) / ev.total : 100;
              setVectorizeState({
                stage: "vectorizing",
                message: `Векторизация: ${ev.processed} из ${ev.total}${ev.remaining != null ? ` (осталось ${ev.remaining})` : ""}`,
                progressPercent: Math.min(100, Math.round(pct)),
                processed: ev.processed,
                total: ev.total,
              });
            } else if (ev.type === "done") {
              finalData = { succeeded: ev.succeeded, total: ev.total, failed: ev.failed };
            }
          } catch {
            /* skip invalid lines */
          }
        }
      }
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer) as { type: string; succeeded?: number; total?: number; failed?: number };
          if (ev.type === "done") {
            finalData = { succeeded: ev.succeeded, total: ev.total, failed: ev.failed };
          }
        } catch {
          /* ignore */
        }
      }

      toast.success(
        `Векторизовано: ${finalData.succeeded ?? 0} из ${finalData.total ?? 0}${(finalData.failed ?? 0) > 0 ? ` (${finalData.failed} пропущено)` : ""}`
      );
      loadCollections();
    } catch {
      toast.error("Ошибка векторизации");
    } finally {
      stageTimeouts.forEach(clearTimeout);
      setVectorizingId(null);
      setVectorizeState(null);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm("Удалить коллекцию? Вектора будут удалены, файлы останутся на диске.")) return;
    setDeletingCollectionId(collectionId);
    try {
      const res = await fetch(`/api/v1/rag/collections/${collectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка удаления коллекции");
        return;
      }
      toast.success("Коллекция удалена");
      loadCollections();
    } catch {
      toast.error("Ошибка удаления коллекции");
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const handleDeleteVectors = async (collectionId: string) => {
    setDeletingId(collectionId);
    try {
      const res = await fetch(`/api/v1/rag/collections/${collectionId}/embeddings`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка удаления векторов");
        return;
      }
      toast.success("Векторы удалены");
      loadCollections();
    } catch {
      toast.error("Ошибка удаления векторов");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFile = (id: string) => {
    setCreateFileIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllFiles = () => {
    if (createFileIds.size === files.length) setCreateFileIds(new Set());
    else setCreateFileIds(new Set(files.map((f) => f.id)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RAG-память</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Векторные «мозги» для AI-агентов. Создайте коллекцию, добавьте файлы и векторизуйте для использования в n8n, чат-ботах и др.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : collections.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="py-16 text-center">
            <BrainCircuit className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Нет RAG-коллекций</p>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Создайте коллекцию, выберите папку или файлы, затем запустите векторизацию. Результаты можно использовать в n8n через API поиска.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-6 gap-2"
            >
              <Plus className="h-4 w-4" />
              Создать RAG-память
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const processableCount = c.processableCount ?? c.filesCount;
            const isFullyVectorized = processableCount > 0 && c.filesWithEmbeddings === processableCount;
            const canDeleteVectors = c.filesWithEmbeddings > 0;
            const isVectorizing = vectorizingId === c.id;
            const vecState = isVectorizing ? vectorizeState : null;
            return (
              <Card key={c.id} className="overflow-hidden border-border bg-surface">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <BrainCircuit className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-0.5">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground">
                                {c.filesCount}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Всего файлов в коллекции</TooltipContent>
                          </Tooltip>
                          <span>/</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground">
                                {processableCount}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Файлов с поддерживаемым форматом (PDF, DOCX, TXT и др.)</TooltipContent>
                          </Tooltip>
                          <span>/</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground">
                                {c.filesWithEmbeddings}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Файлов с созданными векторами (эмбеддингами)</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </p>
                      {c.folder && (
                        <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {c.folder.name}
                        </p>
                      )}
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleCopyId(c.id)}
                              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-left font-mono text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                            >
                              {copiedId === c.id ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="min-w-0 truncate">{shortenId(c.id)}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p>ID для API (collectionId)</p>
                            <p className="mt-0.5 text-muted-foreground">Клик — скопировать</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  {isVectorizing && vecState && (
                    <div className="mt-3 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${vecState.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {vecState.message}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-1 ${isFullyVectorized ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !isFullyVectorized && handleVectorize(c.id)}
                      disabled={vectorizingId !== null || c.filesCount === 0 || isFullyVectorized}
                    >
                      {isVectorizing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      Векторизовать
                    </Button>
                    {canDeleteVectors && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => handleDeleteVectors(c.id)}
                        disabled={deletingId !== null}
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Удалить вектора
                      </Button>
                    )}
                    <Link href="/dashboard/embeddings">
                      <Button size="sm" variant="ghost" className="gap-1">
                        <FileText className="h-3 w-3" />
                        Векторная база
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setExportCollectionId(c.id)}
                    >
                      <Download className="h-3 w-3" />
                      Выгрузка
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={deletingCollectionId !== null}
                        >
                          {deletingCollectionId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteCollection(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Удалить коллекцию
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              Создать RAG-память
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                placeholder="Например: База знаний продукта"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Источник файлов</Label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    checked={createSource === "folder"}
                    onChange={() => setCreateSource("folder")}
                    className="rounded-full"
                  />
                  <FolderOpen className="h-4 w-4" />
                  Папка
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    checked={createSource === "files"}
                    onChange={() => setCreateSource("files")}
                    className="rounded-full"
                  />
                  <FileText className="h-4 w-4" />
                  Выбрать файлы
                </label>
              </div>
            </div>

            {createSource === "folder" && (
              <div>
                <Label>Папка</Label>
                <select
                  value={createFolderId}
                  onChange={(e) => setCreateFolderId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Выберите папку —</option>
                  {loadingFolders ? (
                    <option disabled>Загрузка...</option>
                  ) : (
                    folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.parentId ? `  ${f.name}` : f.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {createSource === "files" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Файлы</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllFiles}
                  >
                    {createFileIds.size === files.length ? "Снять выбор" : "Выбрать все"}
                  </Button>
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-input p-2 space-y-1">
                  {loadingFiles ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Загрузка...</p>
                  ) : files.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Нет файлов</p>
                  ) : (
                    files.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={createFileIds.has(f.id)}
                          onChange={() => toggleFile(f.id)}
                        />
                        <span className="truncate text-sm">{f.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {exportCollectionId && (() => {
        const coll = collections.find((x) => x.id === exportCollectionId);
        return coll ? (
          <ExportDialog
            collectionId={coll.id}
            collectionName={coll.name}
            hasEmbeddings={coll.filesWithEmbeddings > 0}
            onClose={() => setExportCollectionId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
