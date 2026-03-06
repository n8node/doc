"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Database, Loader2, ChevronRight } from "lucide-react";
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

export default function EmbeddingsPage() {
  const [files, setFiles] = useState<EmbeddingFileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/files/embeddings");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Векторная база</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Документы с эмбеддингами. Выберите файл для просмотра и управления чанками.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="py-16 text-center">
            <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Нет обработанных документов</p>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Обработайте документ в разделе «Мои файлы» (кнопка «Анализ документа»). Здесь появятся файлы с эмбеддингами.
            </p>
            <Link
              href="/dashboard/files"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Перейти к файлам
              <span aria-hidden>→</span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Файл</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Папка</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Размер</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Чанков</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Обработан</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 font-medium">{f.embeddingsCount}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(f.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
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
  );
}
