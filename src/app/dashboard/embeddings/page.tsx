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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

interface EmbeddingFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folder: { id: string; name: string } | null;
  embeddingsCount: number;
  createdAt: string;
}

interface CollectionSummary {
  id: string;
  name: string;
  filesCount: number;
  filesWithEmbeddings: number;
}

export default function EmbeddingsPage() {
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("collection") ?? null;

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [files, setFiles] = useState<EmbeddingFileItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        collectionsList.map((c: CollectionSummary) => ({
          id: c.id,
          name: c.name,
          filesCount: c.filesCount ?? 0,
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
        filesList.map((f: EmbeddingFileItem) => ({
          id: String(f?.id ?? ""),
          name: String(f?.name ?? ""),
          mimeType: String(f?.mimeType ?? ""),
          size: Number(f?.size) || 0,
          folder: f?.folder ?? null,
          embeddingsCount: Number(f?.embeddingsCount) || 0,
          createdAt: String(f?.createdAt ?? ""),
        }))
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
                {collections.map((c) => (
                  <Link key={c.id} href={`/dashboard/embeddings?collection=${c.id}`}>
                    <Card className="cursor-pointer border-border bg-surface transition-colors hover:bg-surface2/50">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FolderOpen className="h-5 w-5 text-primary/80" />
                          <BrainCircuit className="absolute right-0 bottom-0 h-4 w-4 rounded bg-primary/20 p-0.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.filesWithEmbeddings} / {c.filesCount} с эмбеддингами
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
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
    </div>
  );
}
