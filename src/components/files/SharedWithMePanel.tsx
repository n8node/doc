"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderOpen,
  Loader2,
  Check,
  X,
  ChevronRight,
  RefreshCw,
  Clock,
  Users,
  Download,
} from "lucide-react";
import { IncomingShareSelectionBar } from "@/components/files/IncomingShareSelectionBar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatBytes } from "@/lib/utils";

const ICON_ACTION =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground";
import { getFileIcon, formatRelativeDate } from "@/components/files/FileCard";

type GrantRow = {
  id: string;
  status: string;
  targetType: string;
  allowCollections: boolean;
  allowAiFeatures: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  owner: { id: string; email: string; name: string | null };
  file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
  } | null;
  folder: { id: string; name: string; createdAt: string } | null;
};

type BrowseData = {
  grant: {
    id: string;
    targetType: string;
    allowCollections: boolean;
    allowAiFeatures: boolean;
  };
  owner: { id: string; name: string | null; email: string };
  currentFolderId: string | null;
  navUpFolderId: string | null;
  folders: Array<{ id: string; name: string; parentId: string | null; createdAt: string }>;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    folderId: string | null;
    hasEmbedding: boolean;
    createdAt: string;
  }>;
};

/** Метка «доступ от пользователя» в стиле AI / Чат / Эмбеддинг */
function SharedAccessBadge({ ownerLabel }: { ownerLabel: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-600 dark:text-sky-400"
      title={`Совместный доступ от ${ownerLabel}`}
    >
      <Users className="h-3 w-3" />
      Доступ
    </span>
  );
}

function ListCheckboxPlaceholder() {
  return (
    <div className="pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center">
      <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-border bg-background" />
    </div>
  );
}

export function SharedWithMePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const grantIdParam = searchParams.get("sharedGrantId");
  const browseFolderId = searchParams.get("sharedBrowseFolderId");

  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [browse, setBrowse] = useState<BrowseData | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [leavingBulk, setLeavingBulk] = useState(false);

  const loadIncoming = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/share/grants/incoming");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка загрузки");
        setGrants([]);
        return;
      }
      setGrants(data.grants ?? []);
    } catch {
      toast.error("Ошибка сети");
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncoming();
  }, [loadIncoming]);

  const loadBrowse = useCallback(async () => {
    if (!grantIdParam) {
      setBrowse(null);
      return;
    }
    setBrowseLoading(true);
    try {
      const q = browseFolderId
        ? `?parentFolderId=${encodeURIComponent(browseFolderId)}`
        : "";
      const res = await fetch(`/api/v1/share/grants/${grantIdParam}/browse${q}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Нет доступа");
        setBrowse(null);
        return;
      }
      setBrowse(data as BrowseData);
    } catch {
      toast.error("Ошибка");
      setBrowse(null);
    } finally {
      setBrowseLoading(false);
    }
  }, [grantIdParam, browseFolderId]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  const setBrowseUrl = (grantId: string | null, folderId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "shared-with-me");
    if (grantId) params.set("sharedGrantId", grantId);
    else params.delete("sharedGrantId");
    if (folderId) params.set("sharedBrowseFolderId", folderId);
    else params.delete("sharedBrowseFolderId");
    router.push(`/dashboard/files?${params.toString()}`);
  };

  const accept = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/share/grants/${id}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success("Доступ принят");
      loadIncoming();
    } catch {
      toast.error("Ошибка");
    }
  };

  const decline = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/share/grants/${id}/decline`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success("Отклонено");
      loadIncoming();
    } catch {
      toast.error("Ошибка");
    }
  };

  const toggleGrantSelection = (grantId: string) => {
    setSelectedGrantIds((prev) => {
      const next = new Set(prev);
      if (next.has(grantId)) next.delete(grantId);
      else next.add(grantId);
      return next;
    });
  };

  const clearGrantSelection = () => setSelectedGrantIds(new Set());

  const selectedGrants = useMemo(
    () => grants.filter((g) => selectedGrantIds.has(g.id)),
    [grants, selectedGrantIds],
  );

  const selectedSize = useMemo(
    () =>
      selectedGrants.reduce((sum, g) => {
        if (g.targetType === "FILE" && g.file?.size) return sum + g.file.size;
        return sum;
      }, 0),
    [selectedGrants],
  );

  const canBulkDownload = useMemo(
    () =>
      selectedGrants.some(
        (g) => g.targetType === "FILE" && g.status === "ACTIVE" && !!g.file?.id,
      ),
    [selectedGrants],
  );

  const openFileDownload = async (fileId: string) => {
    try {
      const res = await fetch(`/api/v1/files/${fileId}/download`);
      const d = await res.json();
      if (res.ok && d.url) window.open(d.url, "_blank", "noopener,noreferrer");
      else toast.error(d.error || "Не удалось открыть");
    } catch {
      toast.error("Ошибка");
    }
  };

  const bulkDownloadSelected = async () => {
    const fileIds = Array.from(
      new Set(
        selectedGrants
          .filter((g) => g.targetType === "FILE" && g.status === "ACTIVE" && g.file?.id)
          .map((g) => g.file!.id),
      ),
    );
    if (fileIds.length === 0) {
      toast.error("Нет файлов для скачивания — нужен принятый доступ к файлу");
      return;
    }
    if (fileIds.length === 1) {
      await openFileDownload(fileIds[0]);
      return;
    }
    const toastId = toast.loading(`Формируется архив (${fileIds.length} файлов)...`);
    try {
      const res = await fetch("/api/v1/files/download-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка формирования архива");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : "files.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Архив скачан (${fileIds.length} файлов)`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка скачивания";
      toast.error(msg, { id: toastId });
    }
  };

  const bulkWithdrawSelected = async () => {
    if (selectedGrantIds.size === 0) return;
    setLeavingBulk(true);
    try {
      let ok = 0;
      for (const id of Array.from(selectedGrantIds)) {
        const res = await fetch(`/api/v1/share/grants/${id}/withdraw`, {
          method: "POST",
        });
        if (res.ok) {
          ok++;
        } else {
          const d = await res.json().catch(() => ({}));
          toast.error(d.error || "Ошибка");
          break;
        }
      }
      if (ok > 0) {
        toast.success(
          ok === 1 ? "Доступ отключён" : `Отключено доступов: ${ok}`,
        );
        clearGrantSelection();
        loadIncoming();
      }
    } finally {
      setLeavingBulk(false);
    }
  };

  if (loading && !grantIdParam) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (grantIdParam) {
    const ownerLabel = browse?.owner.name || browse?.owner.email || "";

    return (
      <TooltipProvider delayDuration={300}>
      <div className="space-y-4 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setBrowseUrl(null, null)}>
            ← К списку
          </Button>
          {browse && browseFolderId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (browse.navUpFolderId) setBrowseUrl(grantIdParam, browse.navUpFolderId);
                else setBrowseUrl(grantIdParam, null);
              }}
            >
              ↑ Вверх
            </Button>
          )}
          {browse && (
            <span className="text-sm text-muted-foreground">
              от <span className="font-medium text-foreground">{ownerLabel}</span>
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto gap-1"
            onClick={() => loadBrowse()}
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        </div>

        {browseLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!browseLoading && browse && (
          <div className="space-y-6">
            {browse.folders.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Папки ({browse.folders.length})
                </p>
                <div className="space-y-1">
                  {browse.folders.map((fo, index) => (
                    <motion.button
                      key={fo.id}
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      onClick={() => setBrowseUrl(grantIdParam, fo.id)}
                      className={cn(
                        "group flex w-full items-center gap-4 rounded-xl border border-transparent px-4 py-3 text-left transition-all duration-200",
                        "bg-surface2/30 hover:bg-surface2/60 hover:shadow-sm"
                      )}
                    >
                      <ListCheckboxPlaceholder />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{fo.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>Папка</span>
                          <span>•</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(fo.createdAt)}
                          </span>
                          <span>•</span>
                          <SharedAccessBadge ownerLabel={ownerLabel} />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {browse.files.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Файлы ({browse.files.length})
                </p>
                <div className="space-y-1">
                  {browse.files.map((fi, index) => {
                    const { icon: Icon, color, bg } = getFileIcon(fi.mimeType);
                    return (
                      <motion.div
                        key={fi.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className={cn(
                          "group flex items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-all duration-200",
                          "bg-surface2/30 hover:bg-surface2/60 hover:shadow-sm"
                        )}
                      >
                        <ListCheckboxPlaceholder />
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            bg
                          )}
                        >
                          <Icon className={cn("h-5 w-5", color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{fi.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatBytes(fi.size)}</span>
                            <span>•</span>
                            <span className="flex shrink-0 items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(fi.createdAt)}
                            </span>
                            <span>•</span>
                            <SharedAccessBadge ownerLabel={ownerLabel} />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={ICON_ACTION}
                                onClick={() => openFileDownload(fi.id)}
                                aria-label="Скачать"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Скачать</TooltipContent>
                          </Tooltip>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {browse.grant.targetType === "FILE" &&
              browse.files.length === 1 &&
              browse.folders.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Нажмите иконку загрузки, чтобы скачать файл.
                </p>
              )}

            {browse.folders.length === 0 && browse.files.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Пусто</p>
            )}
          </div>
        )}
      </div>
      </TooltipProvider>
    );
  }

  const folderGrants = grants.filter((g) => g.targetType === "FOLDER");
  const fileGrants = grants.filter((g) => g.targetType === "FILE");

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6 px-4 py-2 sm:px-6">
      <p className="text-sm text-muted-foreground">
        Файлы и папки, к которым вам открыли доступ по email. Публичные ссылки — в разделе «Публичные ссылки».
      </p>

      {grants.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Нет приглашений
        </div>
      )}

      {folderGrants.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Папки ({folderGrants.length})
          </p>
          <div className="space-y-1">
            {folderGrants.map((g, index) => {
              const ownerLabel = g.owner.name || g.owner.email;
              const folderName = g.folder?.name ?? "Папка";
              const createdAt = g.folder?.createdAt ?? g.createdAt;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-transparent px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
                    "bg-surface2/30 hover:bg-surface2/60"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selectedGrantIds.has(g.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGrantSelection(g.id);
                      }}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        selectedGrantIds.has(g.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50",
                      )}
                    >
                      {selectedGrantIds.has(g.id) && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{folderName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>Папка</span>
                        <span>•</span>
                        <span>
                          от <span className="text-foreground">{ownerLabel}</span>
                        </span>
                        <span>•</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeDate(createdAt)}
                        </span>
                        {g.expiresAt && (
                          <>
                            <span>•</span>
                            <span>до {new Date(g.expiresAt).toLocaleString("ru-RU")}</span>
                          </>
                        )}
                        <span>•</span>
                        <span
                          className={
                            g.status === "PENDING"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {g.status === "PENDING" ? "Ожидает ответа" : "Доступ активен"}
                        </span>
                        <span>•</span>
                        <SharedAccessBadge ownerLabel={ownerLabel} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1 pl-14 sm:pl-0">
                    {g.status === "PENDING" && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(ICON_ACTION, "text-success hover:bg-success/10")}
                              onClick={() => accept(g.id)}
                              aria-label="Принять"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Принять</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(ICON_ACTION, "text-muted-foreground hover:text-destructive")}
                              onClick={() => decline(g.id)}
                              aria-label="Отклонить"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Отклонить</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {g.status === "ACTIVE" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(ICON_ACTION, "text-primary hover:bg-primary/10")}
                            onClick={() => setBrowseUrl(g.id, null)}
                            aria-label="Открыть папку"
                          >
                            <FolderOpen className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Открыть папку</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {fileGrants.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Файлы ({fileGrants.length})
          </p>
          <div className="space-y-1">
            {fileGrants.map((g, index) => {
              const ownerLabel = g.owner.name || g.owner.email;
              const fileName = g.file?.name ?? "Файл";
              const mime = g.file?.mimeType ?? "application/octet-stream";
              const { icon: Icon, color, bg } = getFileIcon(mime);
              const size = g.file?.size ?? 0;
              const fileCreated = g.file?.createdAt ?? g.createdAt;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-transparent px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
                    "bg-surface2/30 hover:bg-surface2/60"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selectedGrantIds.has(g.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGrantSelection(g.id);
                      }}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        selectedGrantIds.has(g.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50",
                      )}
                    >
                      {selectedGrantIds.has(g.id) && <Check className="h-3 w-3" />}
                    </button>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
                      <Icon className={cn("h-5 w-5", color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {size > 0 && (
                          <>
                            <span>{formatBytes(size)}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>
                          от <span className="text-foreground">{ownerLabel}</span>
                        </span>
                        <span>•</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeDate(fileCreated)}
                        </span>
                        {g.expiresAt && (
                          <>
                            <span>•</span>
                            <span>до {new Date(g.expiresAt).toLocaleString("ru-RU")}</span>
                          </>
                        )}
                        <span>•</span>
                        <span
                          className={
                            g.status === "PENDING"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {g.status === "PENDING" ? "Ожидает ответа" : "Доступ активен"}
                        </span>
                        <span>•</span>
                        <SharedAccessBadge ownerLabel={ownerLabel} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1 pl-14 sm:pl-0">
                    {g.status === "PENDING" && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(ICON_ACTION, "text-success hover:bg-success/10")}
                              onClick={() => accept(g.id)}
                              aria-label="Принять"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Принять</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(ICON_ACTION, "text-muted-foreground hover:text-destructive")}
                              onClick={() => decline(g.id)}
                              aria-label="Отклонить"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Отклонить</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {g.status === "ACTIVE" && g.file && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={ICON_ACTION}
                            onClick={() => openFileDownload(g.file!.id)}
                            aria-label="Скачать"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Скачать</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <IncomingShareSelectionBar
        selectedCount={selectedGrantIds.size}
        selectedSize={selectedSize}
        canDownload={canBulkDownload}
        onDownload={() => void bulkDownloadSelected()}
        onLeaveShare={() => void bulkWithdrawSelected()}
        onClear={clearGrantSelection}
        leaving={leavingBulk}
      />
    </div>
    </TooltipProvider>
  );
}
