"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Database,
  CheckSquare,
  Square,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmbeddingItem {
  id: string;
  chunkIndex: number;
  chunkText: string;
  createdAt: string;
}

const ROWS_OPTIONS = [10, 20, 50, 100];

export default function EmbeddingsDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const { fileId } = use(params);
  const router = useRouter();
  const [fileName, setFileName] = useState<string>("");
  const [embeddings, setEmbeddings] = useState<EmbeddingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, embRes] = await Promise.all([
        fetch("/api/v1/files/embeddings"),
        fetch(`/api/v1/files/${fileId}/embeddings?page=${page}&limit=${limit}`),
      ]);
      const filesData = await filesRes.json();
      const file = (filesData.files ?? []).find((f: { id: string; name: string }) => f.id === fileId);
      setFileName(file?.name ?? "Документ");

      const embData = await embRes.json();
      if (!embRes.ok) {
        if (embRes.status === 404 || embData.error?.includes("not found")) {
          router.replace("/dashboard/embeddings");
          return;
        }
        toast.error(embData.error || "Ошибка загрузки");
        return;
      }
      setEmbeddings(embData.embeddings ?? []);
      setTotal(embData.total ?? 0);
      setTotalPages(embData.totalPages ?? 1);
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [fileId, page, limit, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === embeddings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(embeddings.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Удалить ${ids.length} чанк(ов)?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/files/${fileId}/embeddings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Удалено: ${data.deleted}`);
        setSelected(new Set());
        if (data.deleted >= total) {
          router.replace("/dashboard/embeddings");
          return;
        }
        loadData();
      } else {
        toast.error(data.error || "Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Удалить этот чанк?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/files/${fileId}/embeddings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Удалено");
        if (total <= 1) {
          router.replace("/dashboard/embeddings");
          return;
        }
        loadData();
      } else {
        toast.error(data.error || "Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setDeleting(false);
    }
  };

  const truncate = (s: string, max: number) =>
    s.length <= max ? s : s.slice(0, max) + "…";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/embeddings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Векторная база
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium truncate max-w-[300px]">{fileName}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Эмбеддинги документа</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fileName} — {total} чанк(ов)
        </p>
      </div>

      {selected.size > 0 && (
        <Card className="p-4 flex items-center justify-between border-primary/30 bg-primary/5">
          <span className="text-sm font-medium">
            Выбрано: {selected.size}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Удалить выбранные
          </Button>
        </Card>
      )}

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Строк на странице:</span>
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          {ROWS_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : embeddings.length === 0 ? (
        <Card className="py-16 text-center">
          <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">Нет чанков</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Все эмбеддинги удалены или файл не найден.
          </p>
          <Link
            href="/dashboard/embeddings"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Вернуться к списку
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="w-12 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="p-1 rounded hover:bg-surface2"
                    >
                      {selected.size === embeddings.length ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">№</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Текст</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {embeddings.map((e) => (
                  <tr key={e.id} className="border-b border-border hover:bg-surface2/20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(e.id)}
                        className="p-1 rounded hover:bg-surface2"
                      >
                        {selected.has(e.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.chunkIndex + 1}</td>
                    <td className="px-4 py-3 max-w-md">
                      <span title={e.chunkText}>{truncate(e.chunkText, 200)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(e.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(e.id)}
                        disabled={deleting}
                        className="p-1.5 rounded text-muted-foreground hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Стр. {page} из {totalPages} ({total} всего)
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
