"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Copy,
  Pencil,
  ScanSearch,
  BrainCircuit,
  FileWarning,
  CheckSquare,
  Mic2,
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
import { FullPageDropOverlay } from "./FullPageDropOverlay";
import { EmptyState } from "./EmptyState";
import { FileCard, FolderCard } from "./FileCard";
import { UploadProgress, UploadingFile } from "./UploadProgress";
import { SelectionBar } from "./SelectionBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { ShareDialog } from "./ShareDialog";
import { ShareLinksListDialog } from "./ShareLinksListDialog";
import { MoveDialog } from "./MoveDialog";
import { RenameDialog } from "./RenameDialog";
import { DocumentChatDialog } from "./DocumentChatDialog";
import { TranscriptDialog } from "./TranscriptDialog";
import { TranscriptionProgressBar } from "./TranscriptionProgressBar";
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
  aiMetadata?: {
    processedAt?: string;
    numPages?: number;
    tablesCount?: number;
    transcriptProcessedAt?: string;
    transcriptProvider?: string;
  } | null;
  createdAt: string;
  hasShareLink?: boolean;
  shareLinksCount?: number;
  deletedAt?: string | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  summary: string;
  files: Array<{
    id: string | null;
    name: string;
    size: number | null;
  }>;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  hasShareLink?: boolean;
  shareLinksCount?: number;
  deletedAt?: string | null;
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

function isScanPdfError(err: string): boolean {
  return /EasyOCR|OCR engine|pip install easyocr/i.test(err ?? "");
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
  const isHistorySection = activeSection === "history";
  const isTrashSection = activeSection === "trash";
  const normalizedViewMode = parseViewMode(viewParam, isPhotosSection ? "grid" : "list");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const handleUploadRef = useRef<(files: File[]) => void>(() => {});

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderIdParam || null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: "Мои файлы" }]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const cancelUploadRef = useRef(false);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const [analyzingFiles, setAnalyzingFiles] = useState<Set<string>>(new Set());
  const [analyzeError, setAnalyzeError] = useState<Map<string, string>>(new Map());
  const [analyzeEstimateMinutes, setAnalyzeEstimateMinutes] = useState<Map<string, number>>(new Map());
  const [analyzeStartedAt, setAnalyzeStartedAt] = useState<Map<string, number>>(new Map());
  const [transcribingFiles, setTranscribingFiles] = useState<Set<string>>(new Set());
  const [transcribingProvider, setTranscribingProvider] = useState<Map<string, string>>(new Map());
  const [transcribeError, setTranscribeError] = useState<Map<string, string>>(new Map());
  const [transcribeEstimateMinutes, setTranscribeEstimateMinutes] = useState<Map<string, number>>(new Map());
  const [transcribeStartedAt, setTranscribeStartedAt] = useState<Map<string, number>>(new Map());
  const [embeddingTokensQuota, setEmbeddingTokensQuota] = useState<number | null>(null);
  const [embeddingTokensUsedThisMonth, setEmbeddingTokensUsedThisMonth] = useState<number>(0);
  const [aiAnalysisDocumentsQuota, setAiAnalysisDocumentsQuota] = useState<number | null>(null);
  const [aiAnalysisDocumentsUsedThisMonth, setAiAnalysisDocumentsUsedThisMonth] = useState<number>(0);
  const [documentAnalysisAllowed, setDocumentAnalysisAllowed] = useState(false);
  const [transcriptionMinutesQuota, setTranscriptionMinutesQuota] = useState<number | null>(null);
  const [transcriptionMinutesUsedThisMonth, setTranscriptionMinutesUsedThisMonth] = useState<number>(0);
  const [documentChatAllowed, setDocumentChatAllowed] = useState(false);

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
    type: "FILE" | "FOLDER";
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
  const [filterProcessed, setFilterProcessed] = useState<"all" | "yes" | "no">("all");
  const [filterTranscribed, setFilterTranscribed] = useState<"all" | "yes" | "no">("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarActivity, setCalendarActivity] = useState<Record<string, number>>({});
  const [calendarActivityLoading, setCalendarActivityLoading] = useState(false);

  const [maxFileSize, setMaxFileSize] = useState<number>(512 * 1024 * 1024); // 512 MB default
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(0);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [scanPdfModalOpen, setScanPdfModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
  } | null>(null);
  const [allRootFolders, setAllRootFolders] = useState<FolderItem[]>([]);
  const [singleMoveTarget, setSingleMoveTarget] = useState<{
    type: "FILE" | "FOLDER";
    id: string;
  } | null>(null);
  const [singleCopyTarget, setSingleCopyTarget] = useState<{
    type: "FILE" | "FOLDER";
    id: string;
    name: string;
    currentFolderId: string | null;
  } | null>(null);
  const [chatFile, setChatFile] = useState<{ id: string; name: string } | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<{ id: string; name: string } | null>(null);

  const openUploadPicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const loadStorageInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/user/storage");
      const data = await res.json();
      if (typeof data.maxFileSize === "number") {
        setMaxFileSize(data.maxFileSize);
      }
      if (typeof data.trashRetentionDays === "number") {
        setTrashRetentionDays(data.trashRetentionDays);
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

    const handleDropUpload = (e: Event) => {
      const files = (e as CustomEvent<{ files: File[] }>).detail?.files;
      if (files?.length) handleUploadRef.current(files);
    };

    window.addEventListener("files:open-upload-dialog", handleOpenUploadDialog);
    window.addEventListener("files:drop-upload", handleDropUpload);
    return () => {
      window.removeEventListener("files:open-upload-dialog", handleOpenUploadDialog);
      window.removeEventListener("files:drop-upload", handleDropUpload);
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
    fetch("/api/v1/folders?parentId=")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  useEffect(() => {
    if (isRecentSection || isPhotosSection || isSharedSection || isHistorySection || isTrashSection) {
      setCurrentFolderId(null);
      return;
    }
    setCurrentFolderId(folderIdParam || null);
  }, [folderIdParam, isRecentSection, isPhotosSection, isSharedSection, isHistorySection, isTrashSection]);

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
    if (isRecentSection || isPhotosSection || isSharedSection || isHistorySection) {
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
    isHistorySection,
    filterType,
    filterSize,
    filterHasShareLink,
  ]);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (isTrashSection) {
        const trashRes = await fetch("/api/v1/trash");
        if (trashRes.ok) {
          const trashData = await trashRes.json();
          setFiles(trashData.files ?? []);
          setFolders(trashData.folders ?? []);
        } else {
          setFiles([]);
          setFolders([]);
        }
        setHistoryEntries([]);
        setBreadcrumbs([{ id: null, name: "Корзина" }]);
        loadStorageInfo();
        return;
      }

      if (isHistorySection) {
        const historyRes = await fetch("/api/v1/files/history?limit=300");
        if (historyRes.ok) {
          const historyData = (await historyRes.json()) as { events?: HistoryEntry[] };
          setHistoryEntries(Array.isArray(historyData.events) ? historyData.events : []);
        } else {
          setHistoryEntries([]);
        }
        setFiles([]);
        setFolders([]);
        setBreadcrumbs([{ id: null, name: "История" }]);
        loadStorageInfo();
        return;
      }

      setHistoryEntries([]);
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

      const filesRes = await fetch(`/api/v1/files?${filesParams.toString()}`);
      let foldersRes: Response | null = null;
      if (isSharedSection) {
        foldersRes = await fetch("/api/v1/folders?scope=all&hasShareLink=true");
      } else if (!isRecentSection && !isPhotosSection) {
        foldersRes = await fetch(`/api/v1/folders?parentId=${currentFolderId || ""}`);
      }

      if (filesRes.ok) {
        const d = await filesRes.json();
        setFiles(d.files ?? []);
      }
      if (foldersRes?.ok) {
        const d = await foldersRes.json();
        setFolders(d.folders ?? []);
      } else if (isRecentSection || isPhotosSection) {
        setFolders([]);
      } else if (isSharedSection) {
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
        const pathRes = await fetch(`/api/v1/folders/${currentFolderId}/path`);
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

      try {
        const planRes = await fetch("/api/v1/plans/me");
        if (planRes.ok) {
          const planData = await planRes.json();
          setEmbeddingTokensQuota(planData.embeddingTokensQuota ?? null);
          setEmbeddingTokensUsedThisMonth(planData.embeddingTokensUsedThisMonth ?? 0);
          setAiAnalysisDocumentsQuota(planData.aiAnalysisDocumentsQuota ?? null);
          setAiAnalysisDocumentsUsedThisMonth(planData.aiAnalysisDocumentsUsedThisMonth ?? 0);
          setDocumentAnalysisAllowed(!!planData.features?.document_analysis);
          setTranscriptionMinutesQuota(planData.transcriptionMinutesQuota ?? null);
          setTranscriptionMinutesUsedThisMonth(planData.transcriptionMinutesUsedThisMonth ?? 0);
          setDocumentChatAllowed(!!planData.features?.document_chat);
        }
      } catch {
        setEmbeddingTokensQuota(null);
        setEmbeddingTokensUsedThisMonth(0);
        setAiAnalysisDocumentsQuota(null);
        setAiAnalysisDocumentsUsedThisMonth(0);
        setDocumentAnalysisAllowed(false);
        setTranscriptionMinutesQuota(null);
        setTranscriptionMinutesUsedThisMonth(0);
      }
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
    isHistorySection,
    isTrashSection,
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

      const activityRes = await fetch(`/api/v1/files/activity?${activityParams.toString()}`);
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

  const handleUpload = async (filesArray: File[]) => {
    if (!filesArray?.length) return;
    const uploadBatchId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    
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

      if (file.size === 0) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadId
              ? {
                  ...f,
                  status: "error" as const,
                  error: "Пустые документы загружать нельзя",
                }
              : f
          )
        );
        toast.error(`${file.name}: пустые документы загружать нельзя`);
        continue;
      }

      if (!Number.isFinite(file.size) || file.size < 0) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadId
              ? {
                  ...f,
                  status: "error" as const,
                  error: "Некорректный размер файла",
                }
              : f
          )
        );
        toast.error(`${file.name}: некорректный размер файла`);
        continue;
      }

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
        const initRes = await fetch("/api/v1/files/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            folderId: currentFolderId,
            mediaDurationSeconds,
            clientBatchId: uploadBatchId,
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
                const completeRes = await fetch("/api/v1/files/upload/complete", {
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
        window.dispatchEvent(new CustomEvent("notifications:refresh"));
      } else if (completed > 0 && errors > 0) {
        toast.warning(`Загружено: ${completed}, ошибок: ${errors}`);
      } else if (errors > 0) {
        toast.error(`Ошибка загрузки ${errors} файлов`);
      }
      
      return currentFiles;
    });
  };

  handleUploadRef.current = handleUpload;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);

    try {
      const res = await fetch("/api/v1/folders", {
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
      const res = await fetch(`/api/v1/files/${fileId}/download`);
      const data = await res.json();
      if (res.ok && data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.name || "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        toast.error("Ошибка скачивания");
      }
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleBulkDownload = async () => {
    const ids = Array.from(selectedFiles);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      await handleDownload(ids[0]);
      return;
    }

    const toastId = toast.loading(`Формируется архив (${ids.length} файлов)...`);
    try {
      const res = await fetch("/api/v1/files/download-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ids }),
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

      toast.success(`Архив скачан (${ids.length} файлов)`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка скачивания";
      toast.error(msg, { id: toastId });
    }
  };

  // REMINDER: Video transcription disabled. Uncomment video mimes when restoring.
  const TRANSCRIBABLE_MIMES = new Set([
    "audio/wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    // "video/mp4",
    // "video/x-msvideo",
    // "video/avi",
    // "video/quicktime",
    // "video/x-m4v",
  ]);

  const PROCESSABLE_MIMES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "text/html",
    "text/plain",
    "text/csv",
    "text/markdown",
  ]);

  const embeddingQuotaExceeded =
    embeddingTokensQuota != null && embeddingTokensUsedThisMonth >= embeddingTokensQuota;

  const analysisDocumentsQuotaExceeded =
    aiAnalysisDocumentsQuota != null && aiAnalysisDocumentsUsedThisMonth >= aiAnalysisDocumentsQuota;

  const analysisAllowed =
    documentAnalysisAllowed && !embeddingQuotaExceeded && !analysisDocumentsQuotaExceeded;

  const transcriptionQuotaExceeded =
    transcriptionMinutesQuota != null &&
    (transcriptionMinutesUsedThisMonth ?? 0) >= transcriptionMinutesQuota;

  const pollTranscribeStatus = async (fileId: string, toastId: string | number): Promise<"ok" | "err"> => {
    const maxAttempts = 600;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/v1/files/transcribe?fileId=${encodeURIComponent(fileId)}`);
        const data = await res.json();
        if (data.status === "completed" && data.transcriptText != null) {
          toast.success("Транскрипт готов", { id: toastId });
          window.dispatchEvent(new CustomEvent("notifications:refresh"));
          return "ok";
        }
        if (data.status === "failed" || data.error) {
          window.dispatchEvent(new CustomEvent("notifications:refresh"));
          toast.error(data.error || "Ошибка транскрибации", { id: toastId });
          setTranscribeError((m) => new Map(m).set(fileId, data.error || "Ошибка"));
          return "err";
        }
      } catch {
        toast.error("Не удалось проверить статус", { id: toastId });
        return "err";
      }
    }
    toast.error("Превышено время ожидания", { id: toastId });
    return "err";
  };

  const handleTranscribeFile = async (id: string) => {
    setTranscribingFiles((s) => new Set(s).add(id));
    setTranscribeError((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });
    const toastId = toast.loading("Транскрибация...");
    try {
      const res = await fetch("/api/v1/files/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Ошибка транскрибации";
        toast.error(msg, { id: toastId });
        setTranscribeError((m) => new Map(m).set(id, msg));
        if (res.status === 403 && data.code === "TRANSCRIPTION_QUOTA_EXCEEDED") loadData();
        return;
      }
      if (res.status === 202 && data.status === "processing") {
        const estMin = data.estimatedProcessingMinutes as number | undefined;
        const provider = data.provider as string | undefined;
        if (estMin != null && estMin > 0) {
          setTranscribeEstimateMinutes((m) => new Map(m).set(id, estMin));
          setTranscribeStartedAt((m) => new Map(m).set(id, Date.now()));
        }
        if (provider) {
          setTranscribingProvider((m) => new Map(m).set(id, provider));
        }
        const loadingMsg =
          estMin != null && estMin > 0
            ? `Транскрибация... (~${estMin} мин)`
            : "Транскрибация...";
        toast.loading(loadingMsg, { id: toastId });
        await pollTranscribeStatus(id, toastId);
        setTranscribeEstimateMinutes((m) => {
          const n = new Map(m);
          n.delete(id);
          return n;
        });
        setTranscribeStartedAt((m) => {
          const n = new Map(m);
          n.delete(id);
          return n;
        });
        loadData();
        return;
      }
      toast.success("Транскрипт готов", { id: toastId });
      loadData();
    } catch {
      toast.error("Не удалось запустить транскрибацию", { id: toastId });
      setTranscribeError((m) => new Map(m).set(id, "Сетевая ошибка"));
    } finally {
      setTranscribingFiles((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setTranscribingProvider((m) => {
        const n = new Map(m);
        n.delete(id);
        return n;
      });
    }
  };

  const pollProcessStatus = async (fileId: string, toastId: string | number): Promise<"ok" | "err"> => {
    const maxAttempts = 600;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/v1/files/process?fileId=${encodeURIComponent(fileId)}`);
        const data = await res.json();
        if (data.status === "completed" && data.metadata?.processedAt) {
          const meta = data.metadata as { processedAt?: string; numPages?: number };
          toast.success(
            `Документ обработан${meta.numPages ? `, ${meta.numPages} стр.` : ""}`,
            { id: toastId },
          );
          window.dispatchEvent(new CustomEvent("notifications:refresh"));
          return "ok";
        }
        if (data.status === "failed" || data.error) {
          window.dispatchEvent(new CustomEvent("notifications:refresh"));
          const errMsg = data.error || "Ошибка обработки";
          if (isScanPdfError(errMsg)) setScanPdfModalOpen(true);
          toast.error(isScanPdfError(errMsg) ? "Документ — скан, анализ недоступен" : errMsg, { id: toastId });
          setAnalyzeError((m) => new Map(m).set(fileId, errMsg));
          return "err";
        }
      } catch {
        toast.error("Не удалось проверить статус", { id: toastId });
        return "err";
      }
    }
    toast.error("Превышено время ожидания", { id: toastId });
    return "err";
  };

  const handleProcessFile = async (id: string) => {
    setAnalyzingFiles((s) => new Set(s).add(id));
    setAnalyzeError((m) => { const n = new Map(m); n.delete(id); return n; });
    const toastId = toast.loading("AI анализ документа...");
    try {
      const res = await fetch("/api/v1/files/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Ошибка обработки";
        toast.error(msg, { id: toastId });
        setAnalyzeError((m) => new Map(m).set(id, msg));
        if (res.status === 403 && (data.code === "EMBEDDING_QUOTA_EXCEEDED" || data.code === "DOCUMENT_ANALYSIS_DISABLED" || data.code === "AI_ANALYSIS_DOCUMENTS_QUOTA_EXCEEDED")) loadData();
        return;
      }
      if (res.status === 202 && data.status === "processing") {
        setAiAnalysisDocumentsUsedThisMonth((c) => c + 1);
        const estMin = data.estimatedProcessingMinutes as number | undefined;
        if (estMin != null && estMin > 0) {
          setAnalyzeEstimateMinutes((m) => new Map(m).set(id, estMin));
          setAnalyzeStartedAt((m) => new Map(m).set(id, Date.now()));
        }
        const loadingMsg =
          estMin != null && estMin > 0
            ? `Анализ документа... (~${estMin} мин)`
            : "Анализ документа...";
        toast.loading(loadingMsg, { id: toastId });
        await pollProcessStatus(id, toastId);
        setAnalyzeEstimateMinutes((m) => { const n = new Map(m); n.delete(id); return n; });
        setAnalyzeStartedAt((m) => { const n = new Map(m); n.delete(id); return n; });
        loadData();
        return;
      }
      if (data.success && data.textLength != null) {
        toast.success(
          `Документ обработан: ${data.textLength} символов${data.numPages ? `, ${data.numPages} стр.` : ""}`,
          { id: toastId },
        );
        loadData();
      }
    } catch {
      toast.error("Не удалось запустить обработку", { id: toastId });
      setAnalyzeError((m) => new Map(m).set(id, "Сетевая ошибка"));
    } finally {
      setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkTranscribing, setBulkTranscribing] = useState(false);

  const handleBulkTranscribe = async () => {
    const ids = files
      .filter(
        (f) =>
          selectedFiles.has(f.id) &&
          TRANSCRIBABLE_MIMES.has(f.mimeType) &&
          !f.aiMetadata?.transcriptProcessedAt &&
          (f.mediaMetadata?.durationSeconds != null || f.mimeType.startsWith("audio/")),
      )
      .map((f) => f.id);

    if (ids.length === 0) {
      toast.error("Нет подходящих аудио для транскрибации");
      return;
    }

    setBulkTranscribing(true);
    ids.forEach((id) => setTranscribingFiles((s) => new Set(s).add(id)));

    const toastId = toast.loading(`Транскрибация: запущено ${ids.length} файлов...`);
    const pending = new Set(ids);
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const res = await fetch("/api/v1/files/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id }),
        });
        const data = await res.json();
        if (!res.ok) {
          pending.delete(id);
          failed++;
          setTranscribeError((m) => new Map(m).set(id, data.error || "Ошибка"));
          setTranscribingProvider((m) => { const n = new Map(m); n.delete(id); return n; });
          setTranscribingFiles((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          if (res.status === 403 && data.code === "TRANSCRIPTION_QUOTA_EXCEEDED") {
            loadData();
            toast.error(data.error, { id: toastId });
          }
          continue;
        }
        if (res.status === 202 && data.status === "processing") {
          const estMin = data.estimatedProcessingMinutes as number | undefined;
          const provider = data.provider as string | undefined;
          if (estMin != null && estMin > 0) {
            setTranscribeEstimateMinutes((m) => new Map(m).set(id, estMin));
            setTranscribeStartedAt((m) => new Map(m).set(id, Date.now()));
          }
          if (provider) {
            setTranscribingProvider((m) => new Map(m).set(id, provider));
          }
        }
      } catch {
        pending.delete(id);
        failed++;
        setTranscribeError((m) => new Map(m).set(id, "Сетевая ошибка"));
        setTranscribingProvider((m) => { const n = new Map(m); n.delete(id); return n; });
        setTranscribingFiles((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    }

    const maxPollRounds = 400;
    let pollRounds = 0;
    while (pending.size > 0 && pollRounds < maxPollRounds) {
      pollRounds++;
      await new Promise((r) => setTimeout(r, 2500));
      toast.loading(`Транскрибация: ожидание ${pending.size} из ${ids.length}...`, { id: toastId });
      for (const id of Array.from(pending)) {
        try {
          const res = await fetch(`/api/v1/files/transcribe?fileId=${encodeURIComponent(id)}`);
          const data = await res.json();
          if (data.status === "completed" && data.transcriptText != null) {
            pending.delete(id);
            succeeded++;
            setTranscribeEstimateMinutes((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribeStartedAt((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribingProvider((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribingFiles((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
          } else if (data.status === "failed" || data.error) {
            pending.delete(id);
            failed++;
            setTranscribeError((m) => new Map(m).set(id, data.error || "Ошибка"));
            setTranscribeEstimateMinutes((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribeStartedAt((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribingProvider((m) => { const n = new Map(m); n.delete(id); return n; });
            setTranscribingFiles((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
          }
        } catch {
          /* keep in pending */
        }
      }
    }

    if (pending.size > 0) {
      pending.forEach((fileId) => {
        setTranscribeEstimateMinutes((m) => { const n = new Map(m); n.delete(fileId); return n; });
        setTranscribeStartedAt((m) => { const n = new Map(m); n.delete(fileId); return n; });
        setTranscribingProvider((m) => { const n = new Map(m); n.delete(fileId); return n; });
        setTranscribingFiles((s) => {
          const n = new Set(s);
          n.delete(fileId);
          return n;
        });
        setTranscribeError((m) => new Map(m).set(fileId, "Таймаут ожидания"));
      });
      failed += pending.size;
    }

    if (failed === 0) {
      toast.success(`Транскрибация завершена: ${succeeded} файлов`, { id: toastId });
    } else {
      toast.error(`Транскрибация: ${succeeded} успешно, ${failed} с ошибками`, { id: toastId });
    }
    window.dispatchEvent(new CustomEvent("notifications:refresh"));

    setBulkTranscribing(false);
    clearSelection();
    loadData();
  };

  const handleBulkAnalyze = async () => {
    const processableIds = files
      .filter((f) => selectedFiles.has(f.id) && PROCESSABLE_MIMES.has(f.mimeType) && !f.aiMetadata?.processedAt)
      .map((f) => f.id);

    if (processableIds.length === 0) {
      toast.error("Нет подходящих документов для анализа");
      return;
    }

    setBulkAnalyzing(true);
    processableIds.forEach((id) => setAnalyzingFiles((s) => new Set(s).add(id)));

    const toastId = toast.loading(`AI анализ: запущено ${processableIds.length} документов...`);
    const pending = new Set(processableIds);
    let succeeded = 0;
    let failed = 0;

    for (const id of processableIds) {
      try {
        const res = await fetch("/api/v1/files/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id }),
        });
        const data = await res.json();
        if (!res.ok) {
          pending.delete(id);
          failed++;
          const msg = data.error || "Ошибка";
          setAnalyzeError((m) => new Map(m).set(id, msg));
          setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
          if (res.status === 403 && (data.code === "EMBEDDING_QUOTA_EXCEEDED" || data.code === "DOCUMENT_ANALYSIS_DISABLED" || data.code === "AI_ANALYSIS_DOCUMENTS_QUOTA_EXCEEDED")) {
            loadData();
            toast.error(msg, { id: toastId });
          }
        } else if (res.status === 202 && data.status === "processing") {
          setAiAnalysisDocumentsUsedThisMonth((c) => c + 1);
        }
      } catch {
        pending.delete(id);
        failed++;
        setAnalyzeError((m) => new Map(m).set(id, "Сетевая ошибка"));
        setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
      }
    }

    const maxPollRounds = 400;
    let pollRounds = 0;
    while (pending.size > 0 && pollRounds < maxPollRounds) {
      pollRounds++;
      await new Promise((r) => setTimeout(r, 2500));
      toast.loading(`AI анализ: ожидание ${pending.size} из ${processableIds.length}...`, { id: toastId });
      for (const id of Array.from(pending)) {
        try {
          const res = await fetch(`/api/v1/files/process?fileId=${encodeURIComponent(id)}`);
          const data = await res.json();
          if (data.status === "completed" && data.metadata?.processedAt) {
            pending.delete(id);
            succeeded++;
            setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
          } else if (data.status === "failed" || data.error) {
            pending.delete(id);
            failed++;
            const errMsg = data.error || "Ошибка";
            if (isScanPdfError(errMsg)) setScanPdfModalOpen(true);
            setAnalyzeError((m) => new Map(m).set(id, errMsg));
            setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
          }
        } catch {
          // keep in pending, retry next round
        }
      }
    }

    if (pending.size > 0) {
      pending.forEach((id) => {
        setAnalyzingFiles((s) => { const n = new Set(s); n.delete(id); return n; });
        setAnalyzeError((m) => new Map(m).set(id, "Таймаут ожидания"));
      });
      failed += pending.size;
    }

    if (failed === 0) {
      toast.success(`Анализ завершён: ${succeeded} документов обработано`, { id: toastId });
    } else {
      toast.error(`Анализ: ${succeeded} успешно, ${failed} с ошибками`, { id: toastId });
    }
    window.dispatchEvent(new CustomEvent("notifications:refresh"));

    setBulkAnalyzing(false);
    clearSelection();
    loadData();
  };

  const handleDeleteFile = async (id: string) => {
    const msg = trashRetentionDays > 0 ? "Переместить файл в корзину?" : "Удалить этот файл?";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/v1/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFiles((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        loadStorageInfo();
        toast.success(trashRetentionDays > 0 ? "Файл перемещён в корзину" : "Файл удалён");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const msg = trashRetentionDays > 0
      ? "Переместить папку и всё её содержимое в корзину?"
      : "Удалить папку и всё её содержимое?";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/v1/folders/${id}`, { method: "DELETE" });
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
        toast.success(trashRetentionDays > 0 ? "Папка перемещена в корзину" : "Папка удалена");
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
    const msg = trashRetentionDays > 0
      ? `Переместить ${total} элементов в корзину?`
      : `Удалить ${total} элементов?`;
    if (!confirm(msg)) return;

    for (const id of fileIds) {
      await fetch(`/api/v1/files/${id}`, { method: "DELETE" });
    }
    for (const id of folderIds) {
      await fetch(`/api/v1/folders/${id}`, { method: "DELETE" });
    }

    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    loadData();
    loadStorageInfo();
    toast.success(trashRetentionDays > 0 ? "Перемещено в корзину" : "Удалено");
  };

  // --- Trash-specific actions ---
  const handleTrashPermanentDeleteFile = async (id: string) => {
    if (!confirm("Удалить файл безвозвратно?")) return;
    try {
      const res = await fetch(`/api/v1/trash/${id}?type=file`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFiles((prev) => { const n = new Set(prev); n.delete(id); return n; });
        loadStorageInfo();
        toast.success("Файл удалён безвозвратно");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch { toast.error("Ошибка"); }
  };

  const handleTrashPermanentDeleteFolder = async (id: string) => {
    if (!confirm("Удалить папку безвозвратно?")) return;
    try {
      const res = await fetch(`/api/v1/trash/${id}?type=folder`, { method: "DELETE" });
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setSelectedFolders((prev) => { const n = new Set(prev); n.delete(id); return n; });
        loadStorageInfo();
        toast.success("Папка удалена безвозвратно");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch { toast.error("Ошибка"); }
  };

  const handleTrashRestore = async () => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;
    try {
      const res = await fetch("/api/v1/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds, folderIds }),
      });
      if (res.ok) {
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
        loadData();
        loadStorageInfo();
        toast.success("Элементы восстановлены");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка восстановления");
      }
    } catch { toast.error("Ошибка восстановления"); }
  };

  const handleTrashRestoreSingle = async (type: "file" | "folder", id: string) => {
    const body = type === "file" ? { fileIds: [id] } : { folderIds: [id] };
    try {
      const res = await fetch("/api/v1/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        loadData();
        loadStorageInfo();
        toast.success("Восстановлено");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch { toast.error("Ошибка"); }
  };

  const handleEmptyTrash = async () => {
    if (!confirm("Очистить корзину? Все файлы будут удалены безвозвратно.")) return;
    try {
      const res = await fetch("/api/v1/trash/empty", { method: "POST" });
      if (res.ok) {
        setFiles([]);
        setFolders([]);
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
        loadStorageInfo();
        toast.success("Корзина очищена");
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка");
      }
    } catch { toast.error("Ошибка"); }
  };

  const handleBulkPermanentDelete = async () => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    const total = fileIds.length + folderIds.length;
    if (total === 0) return;
    if (!confirm(`Удалить ${total} элементов безвозвратно?`)) return;

    for (const id of fileIds) {
      await fetch(`/api/v1/trash/${id}?type=file`, { method: "DELETE" });
    }
    for (const id of folderIds) {
      await fetch(`/api/v1/trash/${id}?type=folder`, { method: "DELETE" });
    }

    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    loadData();
    loadStorageInfo();
    toast.success("Удалено безвозвратно");
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
          fetch("/api/v1/files/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: fileIds, action: "move", folderId: targetFolderId }),
          })
        );
      }
      if (folderIds.length > 0) {
        promises.push(
          fetch("/api/v1/folders/bulk", {
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
      fetch("/api/v1/folders?parentId=")
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
    if (!singleMoveTarget) return;

    setMoving(true);
    try {
      const endpoint =
        singleMoveTarget.type === "FILE" ? "/api/v1/files/bulk" : "/api/v1/folders/bulk";
      const payload =
        singleMoveTarget.type === "FILE"
          ? { ids: [singleMoveTarget.id], action: "move", folderId: targetFolderId }
          : { ids: [singleMoveTarget.id], action: "move", parentId: targetFolderId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Move failed");
      }

      setMoveDialogOpen(false);
      setSingleMoveTarget(null);
      loadData();
      fetch("/api/v1/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});
      toast.success(
        singleMoveTarget.type === "FILE" ? "Файл перемещён" : "Папка перемещена"
      );
    } catch {
      toast.error("Ошибка перемещения");
    } finally {
      setMoving(false);
    }
  };

  const handleSingleCopy = async (targetFolderId: string | null) => {
    if (!singleCopyTarget) return;

    setCopying(true);
    try {
      const endpoint =
        singleCopyTarget.type === "FILE" ? "/api/v1/files/bulk" : "/api/v1/folders/bulk";
      const payload =
        singleCopyTarget.type === "FILE"
          ? {
              ids: [singleCopyTarget.id],
              action: "copy",
              folderId: targetFolderId,
            }
          : {
              ids: [singleCopyTarget.id],
              action: "copy",
              parentId: targetFolderId,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: number;
        error?: string;
        errors?: { id: string; message: string }[];
      };

      if (!res.ok || typeof data.ok !== "number" || data.ok < 1) {
        const firstError = Array.isArray(data.errors) && data.errors[0]?.message;
        throw new Error(firstError || data.error || "Ошибка копирования");
      }

      setCopyDialogOpen(false);
      setSingleCopyTarget(null);
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      loadData();
      loadStorageInfo();
      fetch("/api/v1/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});
      toast.success(
        singleCopyTarget.type === "FILE" ? "Файл скопирован" : "Папка скопирована"
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Ошибка копирования";
      toast.error(message);
    } finally {
      setCopying(false);
    }
  };

  const handleBulkCopy = async (targetFolderId: string | null) => {
    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);
    if (fileIds.length === 0 && folderIds.length === 0) return;

    setCopying(true);
    try {
      const requests: Promise<Response>[] = [];
      if (fileIds.length > 0) {
        requests.push(
          fetch("/api/v1/files/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: fileIds,
              action: "copy",
              folderId: targetFolderId,
            }),
          })
        );
      }
      if (folderIds.length > 0) {
        requests.push(
          fetch("/api/v1/folders/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: folderIds,
              action: "copy",
              parentId: targetFolderId,
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      type BulkResult = {
        ok?: number;
        errors?: { id: string; message: string }[];
        error?: string;
      };
      const payloads = await Promise.all(
        responses.map(async (response) => {
          try {
            return (await response.json()) as BulkResult;
          } catch {
            return {} as BulkResult;
          }
        })
      );

      const firstFailedResponse = responses.find((response) => !response.ok);
      if (firstFailedResponse) {
        const index = responses.indexOf(firstFailedResponse);
        const errorMessage = payloads[index]?.error || "Ошибка копирования";
        throw new Error(errorMessage);
      }

      const copiedCount = payloads.reduce((sum, item) => sum + (item.ok ?? 0), 0);
      const allErrors = payloads.flatMap((item) =>
        Array.isArray(item.errors) ? item.errors : []
      );

      if (copiedCount === 0 && allErrors.length > 0) {
        throw new Error(allErrors[0].message || "Ошибка копирования");
      }
      if (copiedCount === 0) {
        throw new Error("Ошибка копирования");
      }

      setCopyDialogOpen(false);
      setSingleCopyTarget(null);
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      loadData();
      loadStorageInfo();
      fetch("/api/v1/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});

      if (allErrors.length > 0) {
        toast.warning(`Скопировано: ${copiedCount}, с ошибками: ${allErrors.length}`);
      } else {
        toast.success(copiedCount === 1 ? "Элемент скопирован" : `Скопировано элементов: ${copiedCount}`);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Ошибка копирования";
      toast.error(message);
    } finally {
      setCopying(false);
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

  const handleQuickSelectAllFolders = () => {
    const allSelected = folders.length > 0 && selectedFolders.size === folders.length;
    setSelectedFolders(allSelected ? new Set() : new Set(folders.map((f) => f.id)));
  };

  const handleQuickSelectAllFiles = () => {
    const allSelected = filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length;
    setSelectedFiles(allSelected ? new Set() : new Set(filteredFiles.map((f) => f.id)));
  };

  const handleQuickSelectAll = () => {
    const totalItems = folders.length + filteredFiles.length;
    const allSelected = selectedFolders.size + selectedFiles.size === totalItems;
    if (allSelected) {
      setSelectedFolders(new Set());
      setSelectedFiles(new Set());
    } else {
      setSelectedFolders(new Set(folders.map((f) => f.id)));
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const openCopyDialog = () => {
    if (selectedFiles.size + selectedFolders.size === 0) return;
    setSingleCopyTarget(null);
    setCopyDialogOpen(true);
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    const endpoint =
      renameTarget.type === "file"
        ? `/api/v1/files/${renameTarget.id}`
        : `/api/v1/folders/${renameTarget.id}`;
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Ошибка переименования");
    }
    setRenameTarget(null);
    loadData();
    if (renameTarget.type === "folder") {
      fetch("/api/v1/folders?parentId=")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.folders)) setAllRootFolders(d.folders); })
        .catch(() => {});
    }
    toast.success(
      renameTarget.type === "file" ? "Файл переименован" : "Папка переименована"
    );
  };

  const navigateToFolder = (id: string | null) => {
    const section =
      id && isSharedSection ? "my-files" : activeSection;
    router.push(
      buildDashboardFilesUrl({
        section,
        folderId: id,
      })
    );
  };

  const streamUrl = (id: string) => `/api/v1/files/${id}/stream`;

  const selectedSize = files
    .filter((f) => selectedFiles.has(f.id))
    .reduce((sum, f) => sum + f.size, 0);
  const selectedCount = selectedFiles.size + selectedFolders.size;

  const filteredFiles = useMemo(() => {
    if (isHistorySection || isTrashSection) return files;
    return files.filter((f) => {
      const meta = f.aiMetadata as { processedAt?: string; transcriptProcessedAt?: string } | null;
      const hasProcessed = !!(meta && meta.processedAt);
      const hasTranscribed = !!(meta && meta.transcriptProcessedAt);
      if (filterProcessed === "yes" && !hasProcessed) return false;
      if (filterProcessed === "no" && hasProcessed) return false;
      if (filterTranscribed === "yes" && !hasTranscribed) return false;
      if (filterTranscribed === "no" && hasTranscribed) return false;
      return true;
    });
  }, [files, filterProcessed, filterTranscribed, isHistorySection, isTrashSection]);

  const recentFileGroups = isRecentSection
    ? (() => {
        const grouped = new Map<string, FileItem[]>();
        for (const file of filteredFiles) {
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

  const historyGroups = isHistorySection
    ? (() => {
        const grouped = new Map<string, HistoryEntry[]>();
        for (const entry of historyEntries) {
          const dateKey = toDateKey(new Date(entry.createdAt));
          const items = grouped.get(dateKey) ?? [];
          items.push(entry);
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
      aiMetadata={file.aiMetadata}
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
              setSingleMoveTarget({ type: "FILE", id: file.id });
              setMoveDialogOpen(true);
            }
          : undefined
      }
      onCopy={() => {
        setSingleCopyTarget({
          type: "FILE",
          id: file.id,
          name: file.name,
          currentFolderId: currentFolderId,
        });
        setCopyDialogOpen(true);
      }}
      onRename={() =>
        setRenameTarget({ type: "file", id: file.id, name: file.name })
      }
      onShareLinksClick={() =>
        setShareLinksTarget({ type: "FILE", id: file.id, name: file.name })
      }
      onProcess={
        analysisAllowed &&
        PROCESSABLE_MIMES.has(file.mimeType) &&
        !file.aiMetadata?.processedAt &&
        !analyzingFiles.has(file.id)
          ? () => handleProcessFile(file.id)
          : undefined
      }
      onTranscribe={
        !transcriptionQuotaExceeded &&
        TRANSCRIBABLE_MIMES.has(file.mimeType) &&
        !file.aiMetadata?.transcriptProcessedAt &&
        !transcribingFiles.has(file.id) &&
        (file.mediaMetadata?.durationSeconds != null || file.mimeType.startsWith("audio/"))
          ? () => handleTranscribeFile(file.id)
          : undefined
      }
      onChat={
        documentChatAllowed &&
        PROCESSABLE_MIMES.has(file.mimeType) &&
        !!file.aiMetadata?.processedAt
          ? () => setChatFile({ id: file.id, name: file.name })
          : undefined
      }
      onViewTranscript={
        TRANSCRIBABLE_MIMES.has(file.mimeType) && !!file.aiMetadata?.transcriptProcessedAt
          ? () => setTranscriptFile({ id: file.id, name: file.name })
          : undefined
      }
      onDelete={() => handleDeleteFile(file.id)}
      index={index}
      isProcessable={PROCESSABLE_MIMES.has(file.mimeType)}
      isAnalyzing={analyzingFiles.has(file.id)}
      analyzeError={analyzeError.get(file.id)}
      analyzeEstimateMinutes={analyzeEstimateMinutes.get(file.id)}
      analyzeStartedAt={analyzeStartedAt.get(file.id)}
      isTranscribable={TRANSCRIBABLE_MIMES.has(file.mimeType)}
      isTranscribing={transcribingFiles.has(file.id)}
      transcribingProvider={transcribingProvider.get(file.id)}
      transcribeError={transcribeError.get(file.id)}
      transcribeEstimateMinutes={transcribeEstimateMinutes.get(file.id)}
      transcribeStartedAt={transcribeStartedAt.get(file.id)}
    />
  );

  const typeFilterActive = !isPhotosSection && filterType !== "all";
  const shareFilterActive = !isSharedSection && filterHasShareLink;
  const processedFilterActive = filterProcessed !== "all";
  const transcribedFilterActive = filterTranscribed !== "all";
  const activeFiltersCount =
    (typeFilterActive ? 1 : 0) +
    (filterSize !== "all" ? 1 : 0) +
    (filterDate !== "all" ? 1 : 0) +
    (shareFilterActive ? 1 : 0) +
    (processedFilterActive ? 1 : 0) +
    (transcribedFilterActive ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  const resetFilters = () => {
    setFilterType("all");
    setFilterSize("all");
    setFilterDate("all");
    setFilterHasShareLink(false);
    setFilterProcessed("all");
    setFilterTranscribed("all");
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

  const showFolders =
    (!isRecentSection && !isPhotosSection && !isHistorySection && !isTrashSection) ||
    isSharedSection;
  const showTrashFolders = isTrashSection;
  const showPhotoGrid = isPhotosSection && viewMode === "grid";
  const hasMoveTargets = currentFolderId !== null || allRootFolders.length > 0;
  const isEmpty = (showFolders || showTrashFolders)
    ? folders.length === 0 && filteredFiles.length === 0
    : filteredFiles.length === 0;
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

              {isTrashSection && (folders.length > 0 || filteredFiles.length > 0) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CheckSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Быстрый выбор</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {folders.length > 0 && (
                      <DropdownMenuItem onClick={handleQuickSelectAllFolders}>
                        Все папки ({folders.length})
                      </DropdownMenuItem>
                    )}
                            {filteredFiles.length > 0 && (
                                <DropdownMenuItem onClick={handleQuickSelectAllFiles}>
                                  Все файлы ({filteredFiles.length})
                      </DropdownMenuItem>
                    )}
                            {(folders.length > 0 || filteredFiles.length > 0) && (
                                <DropdownMenuItem onClick={handleQuickSelectAll}>
                                  Всё на странице ({folders.length + filteredFiles.length})
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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

              {isTrashSection && filteredFiles.length + folders.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEmptyTrash}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Очистить корзину</span>
                </Button>
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
          {!isHistorySection && !isTrashSection && (
            <>
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
                      {!isHistorySection && (folders.length > 0 || filteredFiles.length > 0) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-10 min-w-[140px] items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 text-sm text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <CheckSquare className="h-4 w-4 shrink-0" />
                                Быстрый выбор
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-primary/80" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            {showFolders && folders.length > 0 && (
                              <DropdownMenuItem onClick={handleQuickSelectAllFolders}>
                                Все папки ({folders.length})
                              </DropdownMenuItem>
                            )}
                            {filteredFiles.length > 0 && (
                              <DropdownMenuItem onClick={handleQuickSelectAllFiles}>
                                Все файлы ({filteredFiles.length})
                              </DropdownMenuItem>
                            )}
                            {(folders.length > 0 || filteredFiles.length > 0) && (
                              <DropdownMenuItem onClick={handleQuickSelectAll}>
                                Всё на странице ({folders.length + filteredFiles.length})
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={getFilterTriggerClass(filterProcessed !== "all")}
                          >
                            <span className="truncate">
                              {filterProcessed === "all"
                                ? "AI анализ"
                                : filterProcessed === "yes"
                                  ? "AI: обработаны"
                                  : "AI: не обработаны"}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem onClick={() => setFilterProcessed("all")} className="justify-between">
                            <span>Все</span>
                            {filterProcessed === "all" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFilterProcessed("yes")} className="justify-between">
                            <span>Обработаны</span>
                            {filterProcessed === "yes" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFilterProcessed("no")} className="justify-between">
                            <span>Не обработаны</span>
                            {filterProcessed === "no" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={getFilterTriggerClass(filterTranscribed !== "all")}
                          >
                            <span className="truncate">
                              {filterTranscribed === "all"
                                ? "Транскрибация"
                                : filterTranscribed === "yes"
                                  ? "Транскрипт: есть"
                                  : "Транскрипт: нет"}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem onClick={() => setFilterTranscribed("all")} className="justify-between">
                            <span>Все</span>
                            {filterTranscribed === "all" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFilterTranscribed("yes")} className="justify-between">
                            <span>Есть</span>
                            {filterTranscribed === "yes" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFilterTranscribed("no")} className="justify-between">
                            <span>Нет</span>
                            {filterTranscribed === "no" && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
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

            </>
          )}

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
          {!loading && !isHistorySection && !isTrashSection && isEmpty && (
            <EmptyState
              isSubfolder={isSubfolder}
              onUploadClick={openUploadPicker}
              onCreateFolder={() => setCreateFolderOpen(true)}
            />
          )}

          {/* Trash empty state */}
          {!loading && isTrashSection && isEmpty && (
            <div className="rounded-2xl border border-dashed border-border bg-surface2/30 px-6 py-14 text-center">
              <Trash2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-base font-medium text-foreground">Корзина пуста</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Удалённые файлы и папки будут отображаться здесь.
              </p>
            </div>
          )}

          {/* History timeline */}
          {!loading && isHistorySection && (
            <>
              {historyEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface2/30 px-6 py-14 text-center">
                  <p className="text-base font-medium text-foreground">История пока пуста</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Здесь будут показаны загрузки, перемещения, удаления и операции с доступом.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {historyGroups.map((group) => (
                    <div key={group.dateKey} className="space-y-2">
                      <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-border/70 bg-surface2/30 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{entry.summary}</p>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleTimeString("ru-RU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {entry.files.length > 0 && (
                              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                                {entry.files.slice(0, 12).map((file, index) => (
                                  <li key={`${entry.id}-${file.id ?? file.name}-${index}`} className="truncate">
                                    • {file.name}
                                  </li>
                                ))}
                                {entry.files.length > 12 && (
                                  <li className="text-xs text-muted-foreground/80">
                                    и еще {entry.files.length - 12}
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Trash content */}
          {!loading && isTrashSection && !isEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {trashRetentionDays > 0 && (
                <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
                  Файлы в корзине автоматически удаляются через {trashRetentionDays} дней.
                </div>
              )}

              {folders.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Папки ({folders.length})
                  </p>
                  <div className="space-y-1">
                    {folders.map((folder, index) => {
                      const deletedAt = folder.deletedAt;
                      const deletedLabel = deletedAt
                        ? new Date(deletedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "";
                      return (
                        <motion.div
                          key={folder.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
                            selectedFolders.has(folder.id)
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/70 bg-surface2/30 hover:bg-surface2/50"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleFolderSelect(folder.id, !selectedFolders.has(folder.id))}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              selectedFolders.has(folder.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80 bg-background/90"
                            )}
                          >
                            {selectedFolders.has(folder.id) && <Check className="h-3 w-3" />}
                          </button>
                          <FolderPlus className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
                            {deletedLabel && (
                              <p className="text-xs text-muted-foreground">Удалено: {deletedLabel}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => handleTrashRestoreSingle("folder", folder.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Восстановить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs text-error hover:text-error"
                              onClick={() => handleTrashPermanentDeleteFolder(folder.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Файлы ({filteredFiles.length})
                  </p>
                  <div className="space-y-1">
                    {files.map((file, index) => {
                      const deletedAt = file.deletedAt;
                      const deletedLabel = deletedAt
                        ? new Date(deletedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "";
                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
                            selectedFiles.has(file.id)
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/70 bg-surface2/30 hover:bg-surface2/50"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleFileSelect(file.id, !selectedFiles.has(file.id))}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              selectedFiles.has(file.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80 bg-background/90"
                            )}
                          >
                            {selectedFiles.has(file.id) && <Check className="h-3 w-3" />}
                          </button>
                          <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatBytes(file.size)}</span>
                              {deletedLabel && <span>• Удалено: {deletedLabel}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => handleTrashRestoreSingle("file", file.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Восстановить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-xs text-error hover:text-error"
                              onClick={() => handleTrashPermanentDeleteFile(file.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* File/folder list */}
          {!loading && !isHistorySection && !isTrashSection && !isEmpty && (
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
                        hasShareLink={folder.hasShareLink}
                        shareLinksCount={folder.shareLinksCount}
                        selected={selectedFolders.has(folder.id)}
                        onSelect={handleFolderSelect}
                        onClick={() => navigateToFolder(folder.id)}
                        onShare={() =>
                          setShareTarget({ type: "FOLDER", id: folder.id, name: folder.name })
                        }
                        onShareLinksClick={() =>
                          setShareLinksTarget({ type: "FOLDER", id: folder.id, name: folder.name })
                        }
                        onMove={
                          hasMoveTargets
                            ? () => {
                                setSingleMoveTarget({ type: "FOLDER", id: folder.id });
                                setMoveDialogOpen(true);
                              }
                            : undefined
                        }
                        onCopy={() => {
                          setSingleCopyTarget({
                            type: "FOLDER",
                            id: folder.id,
                            name: folder.name,
                            currentFolderId: currentFolderId,
                          });
                          setCopyDialogOpen(true);
                        }}
                        onRename={() =>
                          setRenameTarget({ type: "folder", id: folder.id, name: folder.name })
                        }
                        onDelete={() => handleDeleteFolder(folder.id)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {filteredFiles.length > 0 && (
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
                        Фото ({filteredFiles.length})
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredFiles.map((file, index) => {
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
                                    setShareLinksTarget({ type: "FILE", id: file.id, name: file.name })
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
                                        setSingleMoveTarget({ type: "FILE", id: file.id });
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
                                    onClick={() => {
                                      setSingleCopyTarget({
                                        type: "FILE",
                                        id: file.id,
                                        name: file.name,
                                        currentFolderId: currentFolderId,
                                      });
                                      setCopyDialogOpen(true);
                                    }}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                                    aria-label="Копировать"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRenameTarget({ type: "file", id: file.id, name: file.name })
                                    }
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                                    aria-label="Переименовать"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  {PROCESSABLE_MIMES.has(file.mimeType) && analyzingFiles.has(file.id) && (() => {
                                    const estMin = analyzeEstimateMinutes.get(file.id);
                                    const startedAt = analyzeStartedAt.get(file.id);
                                    if (estMin != null && estMin > 0 && startedAt != null) {
                                      return (
                                        <TranscriptionProgressBar
                                          key={file.id}
                                          startTimestamp={startedAt}
                                          estimatedSeconds={estMin * 60}
                                          variant="compact"
                                          label="Анализ"
                                          icon={ScanSearch}
                                          color="emerald"
                                          className="rounded-md p-1.5"
                                        />
                                      );
                                    }
                                    return (
                                      <span className="flex items-center rounded-md p-1.5 text-emerald-500 animate-pulse" title="Анализируется...">
                                        <ScanSearch className="h-4 w-4" />
                                      </span>
                                    );
                                  })()}
                                  {PROCESSABLE_MIMES.has(file.mimeType) && analyzeError.get(file.id) && !analyzingFiles.has(file.id) && (
                                    <span className="flex items-center rounded-md p-1.5 text-red-500" title={analyzeError.get(file.id)}>
                                      <BrainCircuit className="h-4 w-4" />
                                    </span>
                                  )}
                                  {analysisAllowed &&
                                    PROCESSABLE_MIMES.has(file.mimeType) &&
                                    !file.aiMetadata?.processedAt &&
                                    !analyzingFiles.has(file.id) && (
                                      <button
                                        type="button"
                                        onClick={() => handleProcessFile(file.id)}
                                        className="rounded-md p-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/10"
                                        aria-label="Анализ документа"
                                      >
                                        <ScanSearch className="h-4 w-4" />
                                      </button>
                                    )}
                                  {PROCESSABLE_MIMES.has(file.mimeType) && file.aiMetadata?.processedAt && !analyzingFiles.has(file.id) && (
                                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600" title="Обработан AI">
                                      <BrainCircuit className="h-3.5 w-3.5" />
                                      AI
                                    </span>
                                  )}
                                  {TRANSCRIBABLE_MIMES.has(file.mimeType) && transcribingFiles.has(file.id) && (() => {
                                    const estMin = transcribeEstimateMinutes.get(file.id);
                                    const startedAt = transcribeStartedAt.get(file.id);
                                    const prov = transcribingProvider.get(file.id);
                                    const provDisplay = prov === "OpenAI" || prov === "openai_whisper" ? "OpenAI" : prov === "QoQon" || prov === "Docling" || prov === "docling" ? "QoQon" : prov || "";
                                    if (estMin != null && estMin > 0 && startedAt != null) {
                                      return (
                                        <span key={file.id} className="flex items-center gap-1">
                                          <TranscriptionProgressBar
                                            startTimestamp={startedAt}
                                            estimatedSeconds={estMin * 60}
                                            variant="compact"
                                            className="rounded-md p-1.5"
                                          />
                                          {provDisplay && <span className="text-xs font-medium text-amber-600">{provDisplay}</span>}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="flex items-center gap-1 rounded-md p-1.5 text-amber-500 animate-pulse" title={provDisplay ? `Транскрибируется... ${provDisplay}` : "Транскрибируется..."}>
                                        <Mic2 className="h-4 w-4" />
                                        {provDisplay && <span className="text-xs font-medium text-amber-600">{provDisplay}</span>}
                                      </span>
                                    );
                                  })()}
                                  {TRANSCRIBABLE_MIMES.has(file.mimeType) && transcribeError.get(file.id) && !transcribingFiles.has(file.id) && (
                                    <span className="flex items-center rounded-md p-1.5 text-red-500" title={transcribeError.get(file.id)}>
                                      <Mic2 className="h-4 w-4" />
                                    </span>
                                  )}
                                  {!transcriptionQuotaExceeded &&
                                    TRANSCRIBABLE_MIMES.has(file.mimeType) &&
                                    !file.aiMetadata?.transcriptProcessedAt &&
                                    !transcribingFiles.has(file.id) &&
                                    (file.mediaMetadata?.durationSeconds != null || file.mimeType.startsWith("audio/")) && (
                                      <button
                                        type="button"
                                        onClick={() => handleTranscribeFile(file.id)}
                                        className="rounded-md p-1.5 text-amber-500 transition-colors hover:bg-amber-500/10"
                                        aria-label="Транскрибировать"
                                      >
                                        <Mic2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  {TRANSCRIBABLE_MIMES.has(file.mimeType) && file.aiMetadata?.transcriptProcessedAt && !transcribingFiles.has(file.id) && (
                                    <button
                                      type="button"
                                      onClick={() => setTranscriptFile({ id: file.id, name: file.name })}
                                      className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20"
                                      title={(() => {
                                        const p = (file.aiMetadata as { transcriptProvider?: string })?.transcriptProvider;
                                        const d = p === "openai_whisper" ? "OpenAI" : p === "docling" ? "QoQon" : p || "";
                                        return `Транскрипт${d ? ` — ${d}` : ""}`;
                                      })()}
                                    >
                                      <Mic2 className="h-3.5 w-3.5" />
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
                        {isSharedSection ? "Общий доступ" : "Файлы"} ({filteredFiles.length})
                      </p>
                      <div className="space-y-1">
                        {filteredFiles.map((file, index) => renderListFile(file, index + folders.length))}
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
          const selectedFiles = Array.from(e.target.files ?? []);
          if (selectedFiles.length) handleUpload(selectedFiles);
          e.target.value = "";
        }}
      />

      {/* Selection bar */}
      {!isHistorySection && !isTrashSection && (
        <SelectionBar
          selectedCount={selectedCount}
          selectedSize={selectedSize}
          onDownload={selectedFiles.size > 0 ? handleBulkDownload : undefined}
          onMove={
            hasMoveTargets
              ? () => {
                  setSingleMoveTarget(null);
                  setMoveDialogOpen(true);
                }
              : undefined
          }
          onCopy={selectedCount > 0 ? openCopyDialog : undefined}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
          onAiAnalyze={
            analysisAllowed &&
            selectedFiles.size > 0 &&
            files.some((f) => selectedFiles.has(f.id) && PROCESSABLE_MIMES.has(f.mimeType) && !f.aiMetadata?.processedAt)
              ? handleBulkAnalyze
              : undefined
          }
          aiAnalyzing={bulkAnalyzing}
          onTranscribe={
            !transcriptionQuotaExceeded &&
            selectedFiles.size > 0 &&
            files.some(
              (f) =>
                selectedFiles.has(f.id) &&
                TRANSCRIBABLE_MIMES.has(f.mimeType) &&
                !f.aiMetadata?.transcriptProcessedAt &&
                (f.mediaMetadata?.durationSeconds != null || f.mimeType.startsWith("audio/")),
            )
              ? handleBulkTranscribe
              : undefined
          }
          transcribeAnalyzing={bulkTranscribing}
        />
      )}

      {/* Trash selection bar */}
      {isTrashSection && selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-5 py-3 shadow-xl">
            <span className="text-sm font-medium">
              Выбрано: {selectedCount}
            </span>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={handleTrashRestore}>
              <RotateCcw className="h-4 w-4" />
              Восстановить
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-error hover:text-error" onClick={handleBulkPermanentDelete}>
              <Trash2 className="h-4 w-4" />
              Удалить навсегда
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Отмена
            </Button>
          </div>
        </motion.div>
      )}

      {/* Move dialog */}
      {!isHistorySection && (
        <MoveDialog
          open={moveDialogOpen}
          onClose={() => {
            setMoveDialogOpen(false);
            setSingleMoveTarget(null);
          }}
          onMove={singleMoveTarget ? handleSingleMove : handleBulkMove}
          currentFolderId={currentFolderId}
          excludeFolderIds={
            singleMoveTarget?.type === "FOLDER"
              ? new Set([singleMoveTarget.id])
              : singleMoveTarget
              ? undefined
              : selectedFolders
          }
          moving={moving}
        />
      )}

      {!isHistorySection && (
        <MoveDialog
          open={copyDialogOpen}
          onClose={() => {
            setCopyDialogOpen(false);
            setSingleCopyTarget(null);
          }}
          onMove={singleCopyTarget ? handleSingleCopy : handleBulkCopy}
          currentFolderId={singleCopyTarget?.currentFolderId ?? currentFolderId}
          excludeFolderIds={
            singleCopyTarget?.type === "FOLDER"
              ? new Set([singleCopyTarget.id])
              : singleCopyTarget
              ? undefined
              : selectedFolders
          }
          moving={copying}
          mode="copy"
          allowCurrentTarget
        />
      )}

      {renameTarget && (
        <RenameDialog
          open
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
          currentName={renameTarget.name}
          itemType={renameTarget.type}
        />
      )}

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

      {/* Scan PDF error dialog */}
      <Dialog open={scanPdfModalOpen} onOpenChange={setScanPdfModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-amber-500" />
              Анализ недоступен
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Этот PDF не содержит текстового слоя (это скан). Анализ сканированных документов пока недоступен.
          </p>
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

      {/* Document chat dialog */}
      {transcriptFile && (
        <TranscriptDialog
          fileId={transcriptFile.id}
          fileName={transcriptFile.name}
          open={!!transcriptFile}
          onOpenChange={(open) => !open && setTranscriptFile(null)}
        />
      )}

      {chatFile && (
        <DocumentChatDialog
          fileId={chatFile.id}
          fileName={chatFile.name}
          open={!!chatFile}
          onOpenChange={(open) => !open && setChatFile(null)}
        />
      )}

      {/* Share links list dialog */}
      <ShareLinksListDialog
        open={!!shareLinksTarget}
        onClose={() => {
          setShareLinksTarget(null);
          loadData();
        }}
        fileId={shareLinksTarget?.type === "FILE" ? shareLinksTarget.id : null}
        folderId={shareLinksTarget?.type === "FOLDER" ? shareLinksTarget.id : null}
        targetName={shareLinksTarget?.name ?? ""}
      />

      <FullPageDropOverlay />
    </>
  );
}
