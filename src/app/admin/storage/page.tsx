"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { 
  FolderOpen, 
  File, 
  Trash2, 
  Loader2, 
  Search,
  ChevronRight,
  Home,
  Download,
  Edit,
  Info,
  Share2,
  HardDrive,
  Files,
  FolderTree,
  Users,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  MoreVertical,
  RefreshCw,
  DollarSign,
  Gift,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameDialog } from "@/components/admin/RenameDialog";
import { ItemDetailsDialog } from "@/components/admin/ItemDetailsDialog";
import { ShareLinksListDialog } from "@/components/files/ShareLinksListDialog";

interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  userId: string;
  userEmail: string | null;
  folderId: string | null;
  createdAt: string;
  hasShares: boolean;
  shareLinksCount: number;
}

interface StorageFolder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  userEmail: string | null;
  createdAt: string;
  filesCount: number;
  childFoldersCount: number;
  totalSize: number;
  totalFilesRecursive: number;
}

interface Breadcrumb {
  id: string | null;
  name: string;
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

interface StorageStats {
  totals: {
    files: number;
    folders: number;
    storageUsed: number;
    rootFiles: number;
    sharedFiles: number;
    recentFiles: number;
  };
  storageCost?: {
    costPerGbDayCents: number;
    expenseCentsPerDay: number;
    expenseFreeCentsPerDay: number;
    expensePaidCentsPerDay: number;
  };
  byPlan?: {
    storageFree: number;
    storagePaid: number;
  };
  mimeTypes: {
    images: number;
    videos: number;
    audio: number;
    documents: number;
    other: number;
  };
  topUsers: Array<{
    id: string;
    email: string | null;
    storageUsed: number;
    filesCount: number;
  }>;
}

export default function AdminStoragePage() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  
  // Filters and search
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [mimeTypeFilter, setMimeTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    type: "file" | "folder";
    id: string | null;
    name: string;
  }>({ open: false, type: "file", id: null, name: "" });
  
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    type: "file" | "folder";
    id: string | null;
  }>({ open: false, type: "file", id: null });

  const [shareLinksDialog, setShareLinksDialog] = useState<{
    open: boolean;
    fileId: string | null;
    fileName: string;
  }>({ open: false, fileId: null, fileName: "" });

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/v1/admin/users");
    if (res.ok) {
      const { users: u } = await res.json();
      setUsers(u ?? []);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/storage/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (userIdFilter) params.set("userId", userIdFilter);
      if (currentFolder) params.set("folderId", currentFolder);
      if (search) params.set("search", search);
      if (mimeTypeFilter !== "all") params.set("mimeType", mimeTypeFilter);
      
      const res = await fetch(`/api/v1/admin/storage?${params}`);
      if (!res.ok) throw new Error("Failed to load data");
      
      const data = await res.json();
      setFiles(data.files ?? []);
      setFolders(data.folders ?? []);
      setBreadcrumbs(data.breadcrumbs ?? []);
      setPagination(data.pagination ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, userIdFilter, currentFolder, search, mimeTypeFilter]);

  const recalcStorage = useCallback(async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/v1/admin/storage/recalc", { method: "POST" });
      if (res.ok) {
        await loadStats();
      }
    } catch (e) {
      console.error("Recalc failed:", e);
    } finally {
      setRecalculating(false);
    }
  }, [loadStats]);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  // Авто-обновление статистики каждые 60 сек
  useEffect(() => {
    const id = setInterval(() => void loadStats(), 60_000);
    return () => clearInterval(id);
  }, [loadStats]);

  // При загрузке страницы — пересчёт User.storageUsed в фоне (синхронизация с фактическими файлами)
  useEffect(() => {
    void fetch("/api/v1/admin/storage/recalc", { method: "POST" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change (page intentionally excluded to avoid infinite loop)
  useEffect(() => {
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdFilter, search, mimeTypeFilter, currentFolder]);

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolder(folderId);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

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

  const toggleSelectAll = () => {
    const allSelected = selectedFiles.size === files.length && selectedFolders.size === folders.length;
    if (allSelected) {
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
      setSelectedFolders(new Set(folders.map(f => f.id)));
    }
  };

  const deleteSelected = async () => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;
    if (!confirm(`Удалить ${fileIds.length} файл(ов) и ${folderIds.length} папок(и)?`)) return;
    
    setDeleting(true);
    try {
      if (fileIds.length > 0) {
        const res = await fetch("/api/v1/admin/files/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: fileIds }),
        });
        if (!res.ok) throw new Error("Failed to delete files");
      }
      for (const id of folderIds) {
        const res = await fetch(`/api/v1/admin/folders/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete folder ${id}`);
      }
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      await Promise.all([loadData(), loadStats()]);
    } catch (e) {
      console.error(e);
      alert("Ошибка при удалении");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/v1/files/${fileId}/download`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("Ошибка получения ссылки для скачивания");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при скачивании");
    }
  };

  const openRenameDialog = (type: "file" | "folder", id: string, name: string) => {
    setRenameDialog({ open: true, type, id, name });
  };

  const openDetailsDialog = (type: "file" | "folder", id: string) => {
    setDetailsDialog({ open: true, type, id });
  };

  const handleRename = async (newName: string) => {
    if (!renameDialog.id) return;
    
    const endpoint = renameDialog.type === "file"
      ? `/api/v1/admin/files/${renameDialog.id}`
      : `/api/v1/admin/folders/${renameDialog.id}`;
    
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    
    if (!res.ok) throw new Error("Rename failed");
    
    // Refresh data
    await loadData();
  };

  const handleDeleteSingle = async (type: "file" | "folder", id: string, name: string) => {
    if (!confirm(`Удалить ${type === "file" ? "файл" : "папку"} "${name}"?`)) return;
    
    try {
      const endpoint = type === "file"
        ? `/api/v1/admin/files/${id}`
        : `/api/v1/admin/folders/${id}`;
      
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      
      await Promise.all([loadData(), loadStats()]);
    } catch (e) {
      console.error(e);
      alert("Ошибка при удалении");
    }
  };

  const getMimeTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-green-500" />;
    if (mimeType.startsWith("video/")) return <Video className="h-4 w-4 text-blue-500" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-4 w-4 text-purple-500" />;
    if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
      return <FileText className="h-4 w-4 text-orange-500" />;
    }
    return <File className="h-4 w-4 text-slate-500" />;
  };

  const totalSelected = selectedFiles.size + selectedFolders.size;
  const allSelected = totalSelected > 0 && selectedFiles.size === files.length && selectedFolders.size === folders.length;
  const someSelected = totalSelected > 0 && !allSelected;

  return (
    <div className="space-y-6">
      {/* Statistics Widgets */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Данные из фактических файлов. Авто-обновление каждые 60 сек.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={recalcStorage}
              disabled={recalculating}
              className="gap-2"
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Обновить статистику
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Общий объём</div>
              </div>
              <div className="text-2xl font-bold">{formatBytes(stats.totals.storageUsed)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Files className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Всего файлов</div>
              </div>
              <div className="text-2xl font-bold">{stats.totals.files.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {stats.totals.recentFiles} за 24ч
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Всего папок</div>
              </div>
              <div className="text-2xl font-bold">{stats.totals.folders.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {stats.totals.rootFiles} в корне
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Расшарено</div>
              </div>
              <div className="text-2xl font-bold">{stats.totals.sharedFiles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                активных ссылок
              </div>
            </CardContent>
          </Card>
          </div>

          {stats.storageCost != null && stats.byPlan != null && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Расход в день</div>
                  </div>
                  <div className="text-2xl font-bold">
                    {(stats.storageCost.expenseCentsPerDay / 100).toFixed(2)} ₽
                  </div>
                  <div className="text-xs text-muted-foreground">
                    по занятому месту и тарифу из Финансов
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Стоимость за ГБ/день</div>
                  </div>
                  <div className="text-2xl font-bold">
                    {(stats.storageCost.costPerGbDayCents / 100).toFixed(2)} ₽
                  </div>
                  <div className="text-xs text-muted-foreground">
                    настройка в разделе Финансы
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Бесплатные тарифы</div>
                  </div>
                  <div className="text-2xl font-bold">{formatBytes(stats.byPlan.storageFree)}</div>
                  <div className="text-xs text-muted-foreground">
                    расход {(stats.storageCost.expenseFreeCentsPerDay / 100).toFixed(2)} ₽/день
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Платные тарифы</div>
                  </div>
                  <div className="text-2xl font-bold">{formatBytes(stats.byPlan.storagePaid)}</div>
                  <div className="text-xs text-muted-foreground">
                    расход {(stats.storageCost.expensePaidCentsPerDay / 100).toFixed(2)} ₽/день
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Main Storage Browser */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>Файловый менеджер</span>
              {currentFolder && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateToFolder(breadcrumbs[breadcrumbs.length - 2]?.id || null)}
                  className="gap-2"
                >
                  ← Назад
                </Button>
              )}
            </div>
            <div className="text-sm font-normal text-muted-foreground">
              {pagination && (
                <div className="text-right">
                  <div>{pagination.totalFiles} файлов, {pagination.totalFolders} папок</div>
                  {currentFolder ? (
                    <div className="text-xs">в текущей папке</div>
                  ) : (
                    <div className="text-xs">всего в системе</div>
                  )}
                </div>
              )}
            </div>
          </CardTitle>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || 'root'} className="flex items-center">
                {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
                <button
                  onClick={() => navigateToFolder(crumb.id)}
                  className="hover:text-foreground hover:underline"
                >
                  {index === 0 ? (
                    <div className="flex items-center gap-1">
                      <Home className="h-4 w-4" />
                      {crumb.name}
                    </div>
                  ) : (
                    crumb.name
                  )}
                </button>
              </div>
            ))}
          </nav>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filters and Search */}
          <div className="space-y-4">
            {/* Active filters indicator */}
            {(search || userIdFilter || mimeTypeFilter !== "all" || currentFolder) && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Активные фильтры:</span>
                {search && <Badge variant="secondary">Поиск: &quot;{search}&quot;</Badge>}
                {userIdFilter && (
                  <Badge variant="secondary">
                    Пользователь: {users.find(u => u.id === userIdFilter)?.email || userIdFilter}
                  </Badge>
                )}
                {mimeTypeFilter !== "all" && <Badge variant="secondary">Тип: {mimeTypeFilter}</Badge>}
                {currentFolder && <Badge variant="secondary">В папке</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setUserIdFilter("");
                    setMimeTypeFilter("all");
                    setCurrentFolder(null);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Сбросить все
                </Button>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
              </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Пользователь:</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              >
                <option value="">Все</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email ?? u.id}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Тип:</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={mimeTypeFilter}
                onChange={(e) => setMimeTypeFilter(e.target.value)}
              >
                <option value="all">Все файлы</option>
                <option value="image">Изображения</option>
                <option value="video">Видео</option>
                <option value="audio">Аудио</option>
                <option value="document">Документы</option>
              </select>
            </div>
            
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
            </Button>
            
            {/* Quick select buttons */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Быстрый выбор
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => {
                    setSelectedFiles(new Set(files.map(f => f.id)));
                  }}>
                    Все файлы ({files.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedFolders(new Set(folders.map(f => f.id)));
                  }}>
                    Все папки ({folders.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const imageFiles = files.filter(f => f.mimeType.startsWith("image/"));
                    setSelectedFiles(new Set(imageFiles.map(f => f.id)));
                  }}>
                    Все изображения ({files.filter(f => f.mimeType.startsWith("image/")).length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const videoFiles = files.filter(f => f.mimeType.startsWith("video/"));
                    setSelectedFiles(new Set(videoFiles.map(f => f.id)));
                  }}>
                    Все видео ({files.filter(f => f.mimeType.startsWith("video/")).length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const sharedFiles = files.filter(f => f.hasShares);
                    setSelectedFiles(new Set(sharedFiles.map(f => f.id)));
                  }}>
                    Расшаренные файлы ({files.filter(f => f.hasShares).length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {totalSelected > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Выбрано: {selectedFiles.size} файлов, {selectedFolders.size} папок
                  {selectedFiles.size > 0 && (
                    <span className="ml-2">
                      ({formatBytes(files.filter(f => selectedFiles.has(f.id)).reduce((sum, f) => sum + f.size, 0))})
                    </span>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelected}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Удалить
                </Button>
              </div>
            )}
            </div>
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
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={toggleSelectAll}
                          className="rounded"
                          title={`Выбрать все (${files.length + folders.length})`}
                        />
                      </th>
                      <th className="w-10 px-3 py-2 text-left">Тип</th>
                      <th className="px-3 py-2 text-left">Имя</th>
                      <th className="px-3 py-2 text-left">Пользователь</th>
                      <th className="px-3 py-2 text-right">Размер</th>
                      <th className="px-3 py-2 text-left">Дата создания</th>
                      <th className="w-10 px-3 py-2 text-left">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folders.map((folder) => (
                      <tr key={`folder-${folder.id}`} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedFolders.has(folder.id)}
                            onChange={() => toggleFolder(folder.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <FolderOpen className="h-4 w-4 text-amber-500" />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigateToFolder(folder.id)}
                            className="font-medium hover:text-primary hover:underline text-left"
                          >
                            {folder.name}
                          </button>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {folder.filesCount} прямых файлов
                            {folder.totalFilesRecursive > folder.filesCount && 
                              `, +${folder.totalFilesRecursive - folder.filesCount} вложенных`
                            }
                            {folder.childFoldersCount > 0 && `, ${folder.childFoldersCount} папок`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {folder.userEmail ?? folder.userId}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div>{formatBytes(folder.totalSize)}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(folder.createdAt).toLocaleString("ru")}
                        </td>
                        <td className="px-3 py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigateToFolder(folder.id)}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                Открыть
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRenameDialog("folder", folder.id, folder.name)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Переименовать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetailsDialog("folder", folder.id)}>
                                <Info className="h-4 w-4 mr-2" />
                                Детали
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteSingle("folder", folder.id, folder.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    
                    {files.map((file) => (
                      <tr key={`file-${file.id}`} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {getMimeTypeIcon(file.mimeType)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{file.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {file.hasShares && (
                              <button
                                type="button"
                                onClick={() => setShareLinksDialog({
                                  open: true,
                                  fileId: file.id,
                                  fileName: file.name,
                                })}
                              >
                                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-primary/10 transition-colors">
                                  <Share2 className="h-2.5 w-2.5 mr-1" />
                                  {file.shareLinksCount} {file.shareLinksCount === 1 ? "ссылка" : "ссылок"}
                                </Badge>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {file.userEmail ?? file.userId}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatBytes(file.size)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(file.createdAt).toLocaleString("ru")}
                        </td>
                        <td className="px-3 py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadFile(file.id)}>
                                <Download className="h-4 w-4 mr-2" />
                                Скачать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRenameDialog("file", file.id, file.name)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Переименовать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetailsDialog("file", file.id)}>
                                <Info className="h-4 w-4 mr-2" />
                                Детали
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteSingle("file", file.id, file.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {files.length === 0 && folders.length === 0 && !loading && (
                  <div className="py-12 text-center text-muted-foreground">
                    {search || userIdFilter || mimeTypeFilter !== "all" 
                      ? "Ничего не найдено" 
                      : "Папка пуста"
                    }
                  </div>
                )}
              </div>

              {/* Pagination */}
              {pagination && pagination.total > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Страница {pagination.page}, всего: {pagination.total} элементов
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
                      disabled={pagination.total <= pagination.limit * pagination.page}
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
      
      {/* Top Users by Storage (if stats loaded) */}
      {stats && stats.topUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Топ пользователей по занятому месту
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{user.email ?? user.id}</div>
                      <div className="text-xs text-muted-foreground">{user.filesCount} файлов</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatBytes(user.storageUsed)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <RenameDialog
        open={renameDialog.open}
        onClose={() => setRenameDialog({ open: false, type: "file", id: null, name: "" })}
        itemType={renameDialog.type}
        itemId={renameDialog.id}
        currentName={renameDialog.name}
        onRename={handleRename}
      />

      <ItemDetailsDialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, type: "file", id: null })}
        itemType={detailsDialog.type}
        itemId={detailsDialog.id}
      />

      <ShareLinksListDialog
        open={shareLinksDialog.open}
        onClose={() => {
          setShareLinksDialog({ open: false, fileId: null, fileName: "" });
          loadData();
        }}
        fileId={shareLinksDialog.fileId}
        folderId={null}
        targetName={shareLinksDialog.fileName}
        isAdmin
      />
    </div>
  );
}