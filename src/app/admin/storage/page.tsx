"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { FolderOpen, File, Trash2, Loader2 } from "lucide-react";

interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  userId: string;
  userEmail: string | null;
  folderId: string | null;
  createdAt: string;
}

interface StorageFolder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  userEmail: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalFiles: number;
  totalFolders: number;
  total: number;
}

interface UserOption {
  id: string;
  email: string | null;
}

export default function AdminStoragePage() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const { users: u } = await res.json();
      setUsers(u ?? []);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (userIdFilter) params.set("userId", userIdFilter);
      const res = await fetch(`/api/admin/storage?${params}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setFiles(data.files ?? []);
      setFolders(data.folders ?? []);
      setPagination(data.pagination ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, userIdFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleFile = (id: string) => {
    setSelectedFiles((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setSelectedFolders((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;
    if (!confirm(`Удалить ${fileIds.length} файл(ов) и ${folderIds.length} папок(и)?`)) return;
    setDeleting(true);
    try {
      if (fileIds.length > 0) {
        const res = await fetch("/api/admin/files/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: fileIds }),
        });
        if (!res.ok) throw new Error("Ошибка удаления файлов");
      }
      for (const id of folderIds) {
        const res = await fetch(`/api/admin/folders/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Ошибка удаления папки ${id}`);
      }
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Ошибка при удалении");
    } finally {
      setDeleting(false);
    }
  };

  const totalSelected = selectedFiles.size + selectedFolders.size;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Файлы и папки всех пользователей. Фильтр по пользователю, массовое удаление.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Пользователь:</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={userIdFilter}
                onChange={(e) => {
                  setUserIdFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email ?? u.id}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
            </Button>
            {totalSelected > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Удалить выбранные ({totalSelected})
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-10 px-3 py-2 text-left"></th>
                      <th className="px-3 py-2 text-left">Тип</th>
                      <th className="px-3 py-2 text-left">Имя</th>
                      <th className="px-3 py-2 text-left">Пользователь</th>
                      <th className="px-3 py-2 text-right">Размер</th>
                      <th className="px-3 py-2 text-left">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folders.map((f) => (
                      <tr key={`f-${f.id}`} className="border-b">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedFolders.has(f.id)}
                            onChange={() => toggleFolder(f.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <FolderOpen className="inline h-4 w-4 text-amber-500" />
                        </td>
                        <td className="px-3 py-2 font-medium">{f.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.userEmail ?? f.userId}</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(f.createdAt).toLocaleString("ru")}
                        </td>
                      </tr>
                    ))}
                    {files.map((f) => (
                      <tr key={`file-${f.id}`} className="border-b">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(f.id)}
                            onChange={() => toggleFile(f.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <File className="inline h-4 w-4 text-slate-500" />
                        </td>
                        <td className="px-3 py-2 font-medium">{f.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.userEmail ?? f.userId}</td>
                        <td className="px-3 py-2 text-right">{formatBytes(f.size)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(f.createdAt).toLocaleString("ru")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {files.length === 0 && folders.length === 0 && !loading && (
                  <div className="py-12 text-center text-muted-foreground">Нет данных</div>
                )}
              </div>

              {pagination && (pagination.totalFiles > 0 || pagination.totalFolders > 0) && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Страница {pagination.page}, всего: файлов {pagination.totalFiles}, папок {pagination.totalFolders}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        (pagination.totalFiles + pagination.totalFolders) <= pagination.limit * pagination.page
                      }
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
