"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FolderPlus,
  LayoutGrid,
  LayoutList,
  RefreshCw,
  Filter,
  Link2,
  Download,
  Share2,
  Trash2,
  FolderInput,
  FileImage,
  ChevronDown,
  RotateCcw,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadZone } from "./UploadZone";
import { EmptyState } from "./EmptyState";
import { FileCard, FolderCard } from "./FileCard";
import { UploadProgress, UploadingFile } from "./UploadProgress";
import { SelectionBar } from "./SelectionBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { ShareDialog } from "./ShareDialog";
import { ShareLinksListDialog } from "./ShareLinksListDialog";
import { MoveDialog } from "./MoveDialog";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { cn, formatBytes } from "@/lib/utils";
import { buildDashboardFilesUrl, parseFilesSection } from "@/lib/files-navigation";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  mediaMetadata: { durationSeconds?: number } | null;
  createdAt: string;
  hasShareLink?: boolean;
  shareLinksCount?: number;
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

interface FilterOption {
  value: string;
  label: string;
}

interface CalendarActivityDay {
  date: string;
  count: number;
}

const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "Все типы" },
  { value: "image", label: "Изображения" },
  { value: "video", label: "Видео" },
  { value: "audio", label: "Аудио" },
  { value: "document", label: "Документы" },
];

const SIZE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "Любой размер" },
  { value: "small", label: "До 10 МБ" },
  { value: "medium", label: "10–100 МБ" },
  { value: "large", label: "Более 100 МБ" },
];

const DATE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "Любая дата" },
  { value: "today", label: "Сегодня" },
  { value: "week", label: "За неделю" },
  { value: "month", label: "За месяц" },
  { value: "custom", label: "Выбор даты" },
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

function formatDateKeyLabel(key: string) {
  const date = parseDateKey(key);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRecentGroupLabel(key: string) {
  const todayKey = toDateKey(new Date());
  if (key === todayKey) return "Сегодня";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === toDateKey(yesterday)) return "Вчера";

  const date = parseDateKey(key);
  const label = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseViewMode(value: string | null | undefined, fallback: "list" | "grid" = "list") {
  if (value === "list" || value === "grid") return value;
  return fallback;
}

export function FileManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderIdParam = searchParams.get("folderId");
  const intentParam = searchParams.get("intent");
  const viewParam = searchParams.get("view");
  const activeSection = parseFilesSection(searchParams.get("section"));
  const isRecentSection = activeSection === "recent";
  const isPhotosSection = activeSection === "photos";
  const isSharedSection = activeSection === "shared";
  const normalizedViewMode = parseViewMode(viewParam, isPhotosSection ? "grid" : "list");
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

  const [shareLinksTarget, setShareLinksTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">(() => normalizedViewMode);

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [filterHasShareLink, setFilterHasShareLink] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarActivity, setCalendarActivity] = useState<Record<string, number>>({});
  const [calendarActivityLoading, setCalendarActivityLoading] = useState(false);

  const [maxFileSize, setMaxFileSize] = useState<number>(512 * 1024 * 1024); // 512 MB default
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [allRootFolders, setAllRootFolders] = useState<FolderItem[]>([]);
  const [singleMoveFile, setSingleMoveFile] = useState<{ id: string; name: string } | null>(null);

  const openUploadPicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const loadStorageInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/user/storage");
      const data = await res.json();
      if (typeof data.maxFileSize === "number") {
        setMaxFileSize(data.maxFileSize);
      }
      if (typeof data.storageUsed === "number") {
        setStorageUsed(data.storageUsed);
      }
      if (typeof data.storageQuota === "number") {
        setStorageQuota(data.storageQuota);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const currentSection = searchParams.get("section");
    if (currentSection === activeSection) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", activeSection);
    router.replace(`/dashboard/files?${nextParams.toString()}`);
  }, [activeSection, router, searchParams]);

  useEffect(() => {
    if (viewMode === normalizedViewMode) return;
    setViewMode(normalizedViewMode);
  }, [normalizedViewMode, viewMode]);

  useEffect(() => {
    if (isPhotosSection) return;
    const currentView = searchParams.get("view");
    if (!currentView) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", activeSection);
    nextParams.delete("view");
    router.replace(`/dashboard/files?${nextParams.toString()}`);
  }, [isPhotosSection, activeSection, router, searchParams]);

  useEffect(() => {
    const handleOpenUploadDialog = () => {
      openUploadPicker();
    };

    window.addEventListener("files:open-upload-dialog", handleOpenUploadDialog);
    return () => {
      window.removeEventListener("files:open-upload-dialog", handleOpenUploadDialog);
    };
  }, [openUploadPicker]);

  useEffect(() => {
    if (intentParam !== "upload") return;

    const timerId = window.setTimeout(() => {
      openUploadPicker();
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("section", activeSection);
      nextParams.delete("intent");
      router.replace(`/dashboard/files?${nextParams.toString()}`);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [intentParam, openUploadPicker, activeSection, router, searchParams]);

  useEffect(() => {
    fetch("/api/folders?parentId=")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  useEffect(() => {
    if (isRecentSection || isPhotosSection || isSharedSection) {
      setCurrentFolderId(null);
      return;
    }
    setCurrentFolderId(folderIdParam || null);
  }, [folderIdParam, isRecentSection, isPhotosSection, isSharedSection]);

  useEffect(() => {
    if (!selectedCustomDate) return;
    const selected = parseDateKey(selectedCustomDate);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedCustomDate]);

  useEffect(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, [activeSection, currentFolderId]);

  const buildBaseFileFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (isRecentSection || isPhotosSection || isSharedSection) {
      params.set("scope", "all");
    } else {
      params.set("folderId", currentFolderId || "");
    }
    if (isPhotosSection) {
      params.set("type", "image");
    } else if (filterType !== "all") {
      params.set("type", filterType);
    }
    if (isSharedSection || filterHasShareLink) params.set("hasShareLink", "true");
    if (filterSize !== "all") {
      if (filterSize === "small") {
        params.set("sizeMax", String(10 * 1024 * 1024)); // 10 MB
      } else if (filterSize === "medium") {
        params.set("sizeMin", String(10 * 1024 * 1024));
        params.set("sizeMax", String(100 * 1024 * 1024)); // 100 MB
      } else if (filterSize === "large") {
        params.set("sizeMin", String(100 * 1024 * 1024));
      }
    }
    return params;
  }, [
    currentFolderId,
    isRecentSection,
    isPhotosSection,
    isSharedSection,
    filterType,
    filterSize,
    filterHasShareLink,
  ]);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const filesParams = buildBaseFileFilterParams();
      if (filterDate !== "all") {
        const now = new Date();
        if (filterDate === "today") {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          filesParams.set("dateFrom", start.toISOString());
          filesParams.set("dateTo", now.toISOString());
        } else if (filterDate === "week") {
          const start = new Date(now);
          start.setDate(start.getDate() - 7);
          filesParams.set("dateFrom", start.toISOString());
          filesParams.set("dateTo", now.toISOString());
        } else if (filterDate === "month") {
          const start = new Date(now);
          start.setMonth(start.getMonth() - 1);
          filesParams.set("dateFrom", start.toISOString());
          filesParams.set("dateTo", now.toISOString());
        } else if (filterDate === "custom" && selectedCustomDate) {
          const selected = parseDateKey(selectedCustomDate);
          const start = new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate(),
            0,
            0,
            0,
            0
          );
          const end = new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate(),
            23,
            59,
            59,
            999
          );
          filesParams.set("dateFrom", start.toISOString());
          filesParams.set("dateTo", end.toISOString());
        }
      }

      const filesRes = await fetch(`/api/files?${filesParams.toString()}`);
      const foldersRes = isRecentSection || isPhotosSection || isSharedSection
        ? null
        : await fetch(`/api/folders?parentId=${currentFolderId || ""}`);

      if (filesRes.ok) {
        const d = await filesRes.json();
        setFiles(d.files ?? []);
      }
      if (foldersRes?.ok) {
        const d = await foldersRes.json();
        setFolders(d.folders ?? []);
      } else if (isRecentSection || isPhotosSection || isSharedSection) {
        setFolders([]);
      }

      let bc: Breadcrumb[] = [{ id: null, name: "Мои файлы" }];
      if (isRecentSection) {
        bc = [{ id: null, name: "Недавние файлы" }];
      } else if (isPhotosSection) {
        bc = [{ id: null, name: "Фото" }];
      } else if (isSharedSection) {
        bc = [{ id: null, name: "Общий доступ" }];
      } else if (currentFolderId) {
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
      loadStorageInfo();
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    currentFolderId,
    isRecentSection,
    isPhotosSection,
    isSharedSection,
    buildBaseFileFilterParams,
    filterDate,
    selectedCustomDate,
    loadStorageInfo,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadCalendarActivity = useCallback(async () => {
    if (!datePickerOpen) return;
    setCalendarActivityLoading(true);
    try {
      const activityParams = buildBaseFileFilterParams();
      const monthKey = `${calendarMonth.getFullYear()}-${String(
        calendarMonth.getMonth() + 1
      ).padStart(2, "0")}`;
      activityParams.set("month", monthKey);
      activityParams.set("tzOffsetMinutes", String(new Date().getTimezoneOffset()));

      const activityRes = await fetch(`/api/files/activity?${activityParams.toString()}`);
      if (!activityRes.ok) {
        setCalendarActivity({});
        return;
      }

      const activityData = (await activityRes.json()) as { days?: CalendarActivityDay[] };
      const nextActivity: Record<string, number> = {};
      for (const day of activityData.days ?? []) {
        if (!day?.date || typeof day.count !== "number" || day.count <= 0) continue;
        nextActivity[day.date] = day.count;
      }
      setCalendarActivity(nextActivity);
    } catch {
      setCalendarActivity({});
    } finally {
      setCalendarActivityLoading(false);
    }
  }, [datePickerOpen, buildBaseFileFilterParams, calendarMonth]);

  useEffect(() => {
    if (!datePickerOpen) return;
    loadCalendarActivity();
  }, [datePickerOpen, loadCalendarActivity]);

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

  const readErrorMessage = async (response: Response, fallback: string) => {
    try {
      const data = (await response.json()) as { error?: string };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } catch {}
    return fallback;
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

      const mediaType = file.type.startsWith("audio/") || file.type.startsWith("video/");
      let mediaDurationSeconds: number | null = null;
      if (mediaType) {
        try {
          mediaDurationSeconds = await getMediaDuration(file);
        } catch {}
      }

      try {
        const initRes = await fetch("/api/files/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            folderId: currentFolderId,
            mediaDurationSeconds,
          }),
        });

        if (!initRes.ok) {
          const errorMsg = await readErrorMessage(initRes, "Ошибка инициализации загрузки");
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadId ? { ...f, status: "error" as const, error: errorMsg } : f
            )
          );
          continue;
        }

        const initData = (await initRes.json()) as {
          uploadUrl: string;
          uploadHeaders?: Record<string, string>;
          uploadSessionToken: string;
        };

        if (!initData.uploadUrl || !initData.uploadSessionToken) {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadId
                ? { ...f, status: "error" as const, error: "Некорректный ответ сервера" }
                : f
            )
          );
          continue;
        }

        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadingFiles((prev) =>
                prev.map((f) => (f.id === uploadId ? { ...f, progress } : f))
              );
            }
          };

          xhr.onload = async () => {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const completeRes = await fetch("/api/files/upload/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    uploadSessionToken: initData.uploadSessionToken,
                  }),
                });

                if (!completeRes.ok) {
                  const errorMsg = await readErrorMessage(completeRes, "Ошибка завершения загрузки");
                  setUploadingFiles((prev) =>
                    prev.map((f) =>
                      f.id === uploadId
                        ? { ...f, status: "error" as const, error: errorMsg }
                        : f
                    )
                  );
                  resolve();
                  return;
                }

                const data = await completeRes.json();
                setUploadingFiles((prev) =>
                  prev.map((f) =>
                    f.id === uploadId
                      ? { ...f, status: "completed" as const, progress: 100 }
                      : f
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
                if (typeof data.size === "number") {
                  setStorageUsed((prev) =>
                    typeof prev === "number" ? prev + data.size : prev
                  );
                }
                resolve();
              } else {
                const errorMsg =
                  xhr.status > 0
                    ? `Ошибка загрузки в хранилище (${xhr.status})`
                    : "Ошибка загрузки в хранилище";
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
                f.id === uploadId
                  ? {
                      ...f,
                      status: "error" as const,
                      error: "Сетевая ошибка или блокировка CORS при загрузке",
                    }
                  : f
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

          xhr.timeout = 30 * 60 * 1000; // 30 минут на файл
          xhr.open("PUT", initData.uploadUrl);
          if (initData.uploadHeaders) {
            for (const [header, value] of Object.entries(initData.uploadHeaders)) {
              xhr.setRequestHeader(header, value);
            }
          }
          xhr.send(file);
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
        if (!currentFolderId) setAllRootFolders((prev) => [...prev, data]);
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
    const fileToDelete = files.find((f) => f.id === id);
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFiles((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        if (fileToDelete) {
          setStorageUsed((prev) =>
            typeof prev === "number" ? Math.max(prev - fileToDelete.size, 0) : prev
          );
        } else {
          loadStorageInfo();
        }
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
        loadStorageInfo();
        if (currentFolderId === id) {
          router.push(buildDashboardFilesUrl({ section: activeSection }));
        }
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
    loadStorageInfo();
    toast.success("Удалено");
  };

  const handleBulkMove = async (targetFolderId: string | null) => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;

    setMoving(true);
    try {
      const promises: Promise<Response>[] = [];
      if (fileIds.length > 0) {
        promises.push(
          fetch("/api/files/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: fileIds, action: "move", folderId: targetFolderId }),
          })
        );
      }
      if (folderIds.length > 0) {
        promises.push(
          fetch("/api/folders/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: folderIds, action: "move", parentId: targetFolderId }),
          })
        );
      }
      await Promise.all(promises);

      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      setMoveDialogOpen(false);
      loadData();
      // Обновляем список корневых папок (дерево в сайдбаре)
      fetch("/api/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});
      toast.success("Элементы перемещены");
    } catch {
      toast.error("Ошибка перемещения");
    } finally {
      setMoving(false);
    }
  };

  const handleSingleMove = async (targetFolderId: string | null) => {
    if (!singleMoveFile) return;

    setMoving(true);
    try {
      const res = await fetch("/api/files/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [singleMoveFile.id],
          action: "move",
          folderId: targetFolderId,
        }),
      });

      if (!res.ok) {
        throw new Error("Move failed");
      }

      setMoveDialogOpen(false);
      setSingleMoveFile(null);
      loadData();
      fetch("/api/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});
      toast.success("Файл перемещён");
    } catch {
      toast.error("Ошибка перемещения");
    } finally {
      setMoving(false);
    }
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
    router.push(
      buildDashboardFilesUrl({
        section: activeSection,
        folderId: id,
      })
    );
  };

  const streamUrl = (id: string) => `/api/files/${id}/stream`;

  const selectedSize = files
    .filter((f) => selectedFiles.has(f.id))
    .reduce((sum, f) => sum + f.size, 0);

  const recentFileGroups = isRecentSection
    ? (() => {
        const grouped = new Map<string, FileItem[]>();
        for (const file of files) {
          const dateKey = toDateKey(new Date(file.createdAt));
          const items = grouped.get(dateKey) ?? [];
          items.push(file);
          grouped.set(dateKey, items);
        }
        return Array.from(grouped.entries()).map(([dateKey, items]) => ({
          dateKey,
          label: formatRecentGroupLabel(dateKey),
          items,
        }));
      })()
    : [];

  const renderListFile = (file: FileItem, index: number) => (
    <FileCard
      key={file.id}
      id={file.id}
      name={file.name}
      mimeType={file.mimeType}
      size={file.size}
      createdAt={file.createdAt}
      mediaMetadata={file.mediaMetadata}
      hasShareLink={file.hasShareLink}
      shareLinksCount={file.shareLinksCount}
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
      onMove={
        hasMoveTargets
          ? () => {
              setSingleMoveFile({ id: file.id, name: file.name });
              setMoveDialogOpen(true);
            }
          : undefined
      }
      onShareLinksClick={() =>
        setShareLinksTarget({ id: file.id, name: file.name })
      }
      onDelete={() => handleDeleteFile(file.id)}
      index={index}
    />
  );

  const typeFilterActive = !isPhotosSection && filterType !== "all";
  const shareFilterActive = !isSharedSection && filterHasShareLink;
  const activeFiltersCount =
    (typeFilterActive ? 1 : 0) +
    (filterSize !== "all" ? 1 : 0) +
    (filterDate !== "all" ? 1 : 0) +
    (shareFilterActive ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;
  const resetFilters = () => {
    setFilterType("all");
    setFilterSize("all");
    setFilterDate("all");
    setFilterHasShareLink(false);
    setSelectedCustomDate(null);
  };
  const activeTypeLabel =
    isPhotosSection
      ? "Изображения"
      : TYPE_FILTER_OPTIONS.find((option) => option.value === filterType)?.label ?? "Все типы";
  const activeSizeLabel =
    SIZE_FILTER_OPTIONS.find((option) => option.value === filterSize)?.label ?? "Любой размер";
  const activeDateLabel =
    filterDate === "custom" && selectedCustomDate
      ? formatDateKeyLabel(selectedCustomDate)
      : DATE_FILTER_OPTIONS.find((option) => option.value === filterDate)?.label ?? "Любая дата";

  const getFilterTriggerClass = (active: boolean) =>
    `relative z-[1] flex h-10 min-w-[150px] items-center justify-between gap-2 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 ${
      active
        ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
        : "border-border bg-surface2 text-foreground hover:bg-surface2/80"
    }`;

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const monthWeekdayOffset = (monthStart.getDay() + 6) % 7;
  const calendarGridStart = new Date(monthStart);
  calendarGridStart.setDate(monthStart.getDate() - monthWeekdayOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarGridStart);
    date.setDate(calendarGridStart.getDate() + index);
    return {
      date,
      dateKey: toDateKey(date),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });

  const handleCustomDateSelect = (date: Date) => {
    setSelectedCustomDate(toDateKey(date));
    setFilterDate("custom");
    setDatePickerOpen(false);
  };

  const openCustomDatePicker = () => {
    if (selectedCustomDate) {
      const selected = parseDateKey(selectedCustomDate);
      setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    setDatePickerOpen(true);
  };

  const handleViewModeChange = (mode: "list" | "grid") => {
    if (viewMode === mode) return;
    setViewMode(mode);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", activeSection);
    if (isPhotosSection) {
      nextParams.set("view", mode);
    } else {
      nextParams.delete("view");
    }
    router.replace(`/dashboard/files?${nextParams.toString()}`);
  };

  const showFolders = !isRecentSection && !isPhotosSection && !isSharedSection;
  const showPhotoGrid = isPhotosSection && viewMode === "grid";
  const hasMoveTargets = currentFolderId !== null || allRootFolders.length > 0;
  const isEmpty = showFolders ? folders.length === 0 && files.length === 0 : files.length === 0;
  const isSubfolder = showFolders && currentFolderId !== null;

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

              {isPhotosSection && (
                <div className="flex items-center rounded-lg border border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("list")}
                    className={`rounded-md p-1.5 transition-colors ${
                      viewMode === "list" ? "bg-surface2 text-foreground" : "text-muted-foreground"
                    }`}
                    aria-label="Список"
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("grid")}
                    className={`rounded-md p-1.5 transition-colors ${
                      viewMode === "grid" ? "bg-surface2 text-foreground" : "text-muted-foreground"
                    }`}
                    aria-label="Плитка"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              )}

              {showFolders && (
                <Button size="sm" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Новая папка</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Filters */}
          <div className="rounded-2xl modal-glass-soft p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Filter className="h-4 w-4" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Фильтры файлов</span>
                    {hasActiveFilters && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Сбросить
                  </Button>
                )}
              </div>

              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="flex min-w-max items-center gap-2">
                  {isPhotosSection ? (
                    <div className={getFilterTriggerClass(true)}>
                      <span className="truncate">{activeTypeLabel}</span>
                      <FileImage className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={getFilterTriggerClass(filterType !== "all")}
                        >
                          <span className="truncate">{activeTypeLabel}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {TYPE_FILTER_OPTIONS.map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() => setFilterType(option.value)}
                            className="justify-between"
                          >
                            <span>{option.label}</span>
                            {filterType === option.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={getFilterTriggerClass(filterSize !== "all")}
                      >
                        <span className="truncate">{activeSizeLabel}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {SIZE_FILTER_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setFilterSize(option.value)}
                          className="justify-between"
                        >
                          <span>{option.label}</span>
                          {filterSize === option.value && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={getFilterTriggerClass(filterDate !== "all")}
                      >
                        <span className="truncate">{activeDateLabel}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {DATE_FILTER_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => {
                            if (option.value === "custom") {
                              openCustomDatePicker();
                              return;
                            }
                            setFilterDate(option.value);
                          }}
                          className="justify-between"
                        >
                          <span>{option.label}</span>
                          {filterDate === option.value && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isSharedSection ? (
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-primary/60 bg-primary/10 px-3 text-sm text-primary">
                      <Link2 className="h-4 w-4" />
                      <span className="whitespace-nowrap">Только с публичной ссылкой</span>
                    </div>
                  ) : (
                    <label
                      className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
                        filterHasShareLink
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/70 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filterHasShareLink}
                        onChange={(e) => setFilterHasShareLink(e.target.checked)}
                        className="sr-only"
                      />
                      <Link2 className="h-4 w-4" />
                      <span className="whitespace-nowrap">С публичной ссылкой</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Upload zone */}
          <UploadZone
            onUpload={handleUpload}
            uploading={uploadingFiles.some((f) => f.status === "uploading")}
            maxFileSize={maxFileSize}
            storageUsed={storageUsed}
            storageQuota={storageQuota}
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
              onUploadClick={openUploadPicker}
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
              {showFolders && folders.length > 0 && (
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
                <>
                  {isRecentSection ? (
                    <div className="space-y-4">
                      {recentFileGroups.map((group, groupIndex) => (
                        <div key={group.dateKey} className="space-y-2">
                          <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {group.label} ({group.items.length})
                          </p>
                          <div className="space-y-1">
                            {group.items.map((file, index) =>
                              renderListFile(file, groupIndex * 100 + index)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : showPhotoGrid ? (
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Фото ({files.length})
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {files.map((file, index) => {
                          const selected = selectedFiles.has(file.id);
                          const createdLabel = new Date(file.createdAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          });
                          return (
                            <motion.div
                              key={file.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: index * 0.02 }}
                              className={cn(
                                "group relative overflow-hidden rounded-2xl border bg-surface2/35 transition-all",
                                selected
                                  ? "border-primary/70 bg-primary/5 shadow-[0_10px_28px_-18px_hsl(var(--primary)/0.9)]"
                                  : "border-border/70 hover:border-primary/40 hover:bg-surface2/55"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => handleFileSelect(file.id, !selected)}
                                className={cn(
                                  "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border/80 bg-background/90 text-muted-foreground"
                                )}
                                aria-label="Выбрать файл"
                              >
                                {selected ? <Check className="h-3 w-3" /> : null}
                              </button>

                              {file.hasShareLink && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShareLinksTarget({ id: file.id, name: file.name })
                                  }
                                  className="absolute right-2 top-2 z-10 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
                                >
                                  {file.shareLinksCount && file.shareLinksCount > 1
                                    ? `Ссылок: ${file.shareLinksCount}`
                                    : "Ссылка"}
                                </button>
                              )}

                              <div className="relative aspect-square overflow-hidden bg-surface2">
                                <Image
                                  src={streamUrl(file.id)}
                                  alt={file.name}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                  unoptimized
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                />
                              </div>

                              <div className="space-y-2 p-3">
                                <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                                  {file.name}
                                </p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{formatBytes(file.size)}</span>
                                  <span>{createdLabel}</span>
                                </div>
                                <div className="flex items-center justify-between gap-1 border-t border-border/60 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(file.id)}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                                    aria-label="Скачать"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShareTarget({ type: "FILE", id: file.id, name: file.name })
                                    }
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                                    aria-label="Поделиться"
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </button>
                                  {hasMoveTargets && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSingleMoveFile({ id: file.id, name: file.name });
                                        setMoveDialogOpen(true);
                                      }}
                                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                                      aria-label="Переместить"
                                    >
                                      <FolderInput className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="rounded-md p-1.5 text-error transition-colors hover:bg-error/10"
                                    aria-label="Удалить"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {isSharedSection ? "Общий доступ" : "Файлы"} ({files.length})
                      </p>
                      <div className="space-y-1">
                        {files.map((file, index) => renderListFile(file, index + folders.length))}
                      </div>
                    </div>
                  )}
                </>
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
        onMove={
          hasMoveTargets
            ? () => {
                setSingleMoveFile(null);
                setMoveDialogOpen(true);
              }
            : undefined
        }
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      {/* Move dialog */}
      <MoveDialog
        open={moveDialogOpen}
        onClose={() => {
          setMoveDialogOpen(false);
          setSingleMoveFile(null);
        }}
        onMove={singleMoveFile ? handleSingleMove : handleBulkMove}
        currentFolderId={currentFolderId}
        excludeFolderIds={singleMoveFile ? undefined : selectedFolders}
        moving={moving}
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

      {/* Date filter picker dialog */}
      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Выбор даты загрузки
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold capitalize">{monthLabel}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAY_LABELS.map((weekday) => (
                <div key={weekday} className="py-1 font-medium">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" />
                Есть загрузки
              </span>
              {calendarActivityLoading ? (
                <span className="animate-pulse">Обновляем активность...</span>
              ) : null}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const isSelected = selectedCustomDate === day.dateKey && filterDate === "custom";
                const isToday = day.dateKey === toDateKey(new Date());
                const dayActivityCount = day.inCurrentMonth ? (calendarActivity[day.dateKey] ?? 0) : 0;
                const hasActivity = dayActivityCount > 0;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    disabled={!day.inCurrentMonth}
                    onClick={() => handleCustomDateSelect(day.date)}
                    title={hasActivity ? `Загрузок в этот день: ${dayActivityCount}` : undefined}
                    className={`relative h-9 rounded-lg text-sm transition-colors ${
                      !day.inCurrentMonth
                        ? "cursor-not-allowed text-muted-foreground/35"
                        : isSelected
                        ? "bg-primary text-primary-foreground"
                        : hasActivity
                        ? "border border-emerald-500/45 bg-emerald-500/12 text-foreground hover:bg-emerald-500/18"
                        : isToday
                        ? "border border-primary/40 bg-primary/10 text-primary"
                        : "hover:bg-surface2"
                    }`}
                  >
                    <span className="pointer-events-none relative z-[1]">{day.date.getDate()}</span>
                    {hasActivity && !isSelected ? (
                      <span className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500/90" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCustomDateSelect(new Date())}
              >
                Сегодня
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCustomDate(null);
                    if (filterDate === "custom") setFilterDate("all");
                    setDatePickerOpen(false);
                  }}
                >
                  Очистить
                </Button>
                <Button type="button" size="sm" onClick={() => setDatePickerOpen(false)}>
                  Готово
                </Button>
              </div>
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

      {/* Share links list dialog */}
      <ShareLinksListDialog
        open={!!shareLinksTarget}
        onClose={() => {
          setShareLinksTarget(null);
          loadData();
        }}
        fileId={shareLinksTarget?.id ?? null}
        fileName={shareLinksTarget?.name ?? ""}
      />
    </>
  );
}
