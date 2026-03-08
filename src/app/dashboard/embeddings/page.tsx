"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Database,
  Loader2,
  ChevronRight,
  BrainCircuit,
  FolderOpen,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import { ExportDialog } from "@/components/rag/ExportDialog";

interface EmbeddingFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folder: { id: string; name: string } | null;
  embeddingsCount: number;
  embeddingModel?: string;
  embeddingTokensUsed?: number;
  createdAt: string;
}

interface CollectionSummary {
  id: string;
  name: string;
  folderId: string | null;
  folder: { id: string; name: string } | null;
  filesCount: number;
  processableCount?: number;
  filesWithEmbeddings: number;
}

export default function EmbeddingsPage() {
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("collection") ?? null;

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [files, setFiles] = useState<EmbeddingFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [exportCollection, setExportCollection] = useState<CollectionSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [collRes, filesRes] = await Promise.all([
        fetch("/api/v1/rag/collections", { credentials: "include" }),
        fetch("/api/v1/files/embeddings", { credentials: "include" }),
      ]);

      const collData = await collRes.json();
      const collectionsList = Array.isArray(collData.collections) ? collData.collections : [];
      setCollections(
        collectionsList.map((c: CollectionSummary & { folderId?: string; folder?: { id: string; name: string } | null; processableCount?: number }) => ({
          id: c.id,
          name: c.name,
          folderId: c.folderId ?? null,
          folder: c.folder ?? null,
          filesCount: c.filesCount ?? 0,
          processableCount: c.processableCount ?? c.filesCount ?? 0,
          filesWithEmbeddings: c.filesWithEmbeddings ?? 0,
        }))
      );

      const filesData = await filesRes.json();
      let filesList = Array.isArray(filesData.files) ? filesData.files : [];

      if (collectionId && collectionsList.length > 0) {
        const coll = collectionsList.find((c: { id: string }) => c.id === collectionId);
        if (coll?.files) {
          const collFileIds = new Set(coll.files.map((f: { id: string }) => f.id));
          filesList = filesList.filter((f: EmbeddingFileItem) => collFileIds.has(f.id));
        }
      }

      setFiles(
        filesList.map((f: EmbeddingFileItem & { aiMetadata?: Record<string, unknown> }) => {
          const meta = f?.aiMetadata as { modelName?: string; embeddingsProvider?: string; embeddingTokensUsed?: number } | undefined;
          return {
            id: String(f?.id ?? ""),
            name: String(f?.name ?? ""),
            mimeType: String(f?.mimeType ?? ""),
            size: Number(f?.size) || 0,
            folder: f?.folder ?? null,
            embeddingsCount: Number(f?.embeddingsCount) || 0,
            embeddingModel: meta?.modelName ?? meta?.embeddingsProvider ?? undefined,
            embeddingTokensUsed: typeof meta?.embeddingTokensUsed === "number" ? meta.embeddingTokensUsed : undefined,
            createdAt: String(f?.createdAt ?? ""),
          };
        })
      );
    } catch {
      setCollections([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCollection = collectionId
    ? collections.find((c) => c.id === collectionId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {activeCollection && (
            <Link
              href="/dashboard/embeddings"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Link>
          )}
          <div>
          <h1 className="text-2xl font-bold text-foreground">Векторная база</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCollection
              ? `Коллекция «${activeCollection.name}»`
              : "RAG-коллекции и документы с эмбеддингами. Выберите коллекцию или файл."}
          </p>
          </div>
        </div>
        {activeCollection && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => setExportCollection(activeCollection)}
          >
            <Download className="h-4 w-4" />
            Выгрузка
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !collectionId ? (
        <>
          {collections.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                RAG-коллекции (папки с векторными данными)
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {collections.map((c) => {
                  const processableCount = c.processableCount ?? c.filesCount;
                  return (
                    <Card key={c.id} className="border-border bg-surface transition-colors hover:bg-surface2/50">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Link href={`/dashboard/embeddings?collection=${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <FolderOpen className="h-5 w-5 text-primary/80" />
                            <BrainCircuit className="absolute right-0 bottom-0 h-4 w-4 rounded bg-primary/20 p-0.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{c.name}</p>
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
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 p-0"
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
                              onClick={() => setExportCollection(c)}
                            >
                              <Download className="h-4 w-4" />
                              Выгрузка
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async (e) => {
                                e.preventDefault();
                                if (!confirm("Удалить коллекцию? Вектора будут удалены, файлы останутся на диске.")) return;
                                setDeletingCollectionId(c.id);
                                try {
                                  const res = await fetch(`/api/v1/rag/collections/${c.id}`, {
                                    method: "DELETE",
                                    credentials: "include",
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    toast.error(data.error || "Ошибка удаления коллекции");
                                    return;
                                  }
                                  toast.success("Коллекция удалена");
                                  loadData();
                                } catch {
                                  toast.error("Ошибка удаления коллекции");
                                } finally {
                                  setDeletingCollectionId(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить коллекцию
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Link
                href="/dashboard/rag-memory"
                className="mt-2 inline-block text-sm text-primary hover:underline"
              >
                Управление RAG-памятью →
              </Link>
            </div>
          )}

          <div className={collections.length > 0 ? "pt-6" : ""}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Все файлы с эмбеддингами
            </h2>
            {files.length === 0 ? (
              <Card className="border-border bg-surface">
                <CardContent className="py-16 text-center">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">
                    Нет обработанных документов
                  </p>
                  <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                    Создайте RAG-память в разделе «RAG-память» или обработайте документ в «Мои файлы».
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link
                      href="/dashboard/rag-memory"
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      RAG-память
                    </Link>
                    <Link
                      href="/dashboard/files"
                      className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Файлы
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface2/30">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Файл
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Папка
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Размер
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Токены
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Модель
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Чанков
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Обработан
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f) => (
                        <tr
                          key={f.id}
                          className="border-b border-border hover:bg-surface2/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium truncate max-w-[240px]">{f.name}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {f.folder?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatBytes(Math.max(0, Number(f.size) || 0))}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {f.embeddingTokensUsed != null ? f.embeddingTokensUsed.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate" title={f.embeddingModel}>
                            {f.embeddingModel ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-medium">{f.embeddingsCount}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {f.createdAt
                              ? new Date(f.createdAt).toLocaleDateString("ru-RU", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/dashboard/embeddings/${f.id}`}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              Эмбеддинги
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      ) : (
        <>
          {files.length === 0 ? (
            <Card className="border-border bg-surface">
              <CardContent className="py-16 text-center">
                <BrainCircuit className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">
                  В этой коллекции нет файлов с эмбеддингами
                </p>
                <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                  Запустите векторизацию в разделе «RAG-память».
                </p>
                <Link
                  href="/dashboard/rag-memory"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  RAG-память
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface2/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Файл
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Папка
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Размер
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Токены
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Модель
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Чанков
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Обработан
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-border hover:bg-surface2/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium truncate max-w-[240px]">{f.name}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {f.folder?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatBytes(Math.max(0, Number(f.size) || 0))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {f.embeddingTokensUsed != null ? f.embeddingTokensUsed.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate" title={f.embeddingModel}>
                          {f.embeddingModel ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-medium">{f.embeddingsCount}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {f.createdAt
                            ? new Date(f.createdAt).toLocaleDateString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/embeddings/${f.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                          >
                            Эмбеддинги
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {exportCollection && (
        <ExportDialog
          collectionId={exportCollection.id}
          collectionName={exportCollection.name}
          hasEmbeddings={exportCollection.filesWithEmbeddings > 0}
          onClose={() => setExportCollection(null)}
        />
      )}
    </div>
  );
}
