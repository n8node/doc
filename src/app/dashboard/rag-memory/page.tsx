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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
    setVectorizingId(collectionId);
    try {
      const res = await fetch(`/api/v1/rag/collections/${collectionId}/vectorize`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Ошибка векторизации");
        return;
      }

      toast.success(
        `Векторизовано: ${data.succeeded} из ${data.total}${data.failed > 0 ? ` (${data.failed} пропущено)` : ""}`
      );
      loadCollections();
    } catch {
      toast.error("Ошибка векторизации");
    } finally {
      setVectorizingId(null);
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
          {collections.map((c) => (
            <Card key={c.id} className="overflow-hidden border-border bg-surface">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.filesCount} файлов • {c.filesWithEmbeddings} с эмбеддингами
                    </p>
                    {c.folder && (
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {c.folder.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleVectorize(c.id)}
                    disabled={vectorizingId !== null || c.filesCount === 0}
                  >
                    {vectorizingId === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Векторизовать
                  </Button>
                  <Link href="/dashboard/embeddings">
                    <Button size="sm" variant="ghost" className="gap-1">
                      <FileText className="h-3 w-3" />
                      Векторная база
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
