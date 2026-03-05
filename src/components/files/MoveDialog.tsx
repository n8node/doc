"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Home,
  FolderOpen,
  ChevronRight,
  Loader2,
  FolderInput,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderOption {
  id: string;
  name: string;
}

interface MoveDialogProps {
  open: boolean;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => void;
  currentFolderId: string | null;
  excludeFolderIds?: Set<string>;
  moving?: boolean;
  mode?: "move" | "copy";
  allowCurrentTarget?: boolean;
}

export function MoveDialog({
  open,
  onClose,
  onMove,
  currentFolderId,
  excludeFolderIds,
  moving = false,
  mode = "move",
  allowCurrentTarget = false,
}: MoveDialogProps) {
  const [rootFolders, setRootFolders] = useState<FolderOption[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, FolderOption[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingRoots, setLoadingRoots] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [isRootSelected, setIsRootSelected] = useState(false);

  const loadRoots = useCallback(async () => {
    setLoadingRoots(true);
    try {
      const res = await fetch("/api/v1/folders?parentId=");
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders)) setRootFolders(data.folders);
    } catch {}
    setLoadingRoots(false);
  }, []);

  useEffect(() => {
    if (open) {
      loadRoots();
      setSelected(null);
      setIsRootSelected(false);
      setExpandedIds(new Set());
    }
  }, [open, loadRoots]);

  const loadChildren = async (parentId: string) => {
    if (childrenMap[parentId]) return;
    setLoadingChildren((prev) => new Set(prev).add(parentId));
    try {
      const res = await fetch(`/api/v1/folders?parentId=${encodeURIComponent(parentId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders))
        setChildrenMap((prev) => ({ ...prev, [parentId]: data.folders }));
    } catch {}
    setLoadingChildren((prev) => {
      const n = new Set(prev);
      n.delete(parentId);
      return n;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    loadChildren(id);
  };

  const selectRoot = () => {
    setIsRootSelected(true);
    setSelected(null);
  };

  const selectFolder = (id: string) => {
    setIsRootSelected(false);
    setSelected(id);
  };

  const handleConfirm = () => {
    if (isRootSelected) onMove(null);
    else if (selected) onMove(selected);
  };

  const isExcluded = (id: string) => !!excludeFolderIds?.has(id);
  const isCurrent = (id: string | null) => id === currentFolderId;
  const isCopyMode = mode === "copy";
  const titleText = isCopyMode ? "Копировать в..." : "Переместить в...";
  const submitText = isCopyMode ? "Копировать" : "Переместить";
  const submittingText = isCopyMode ? "Копирование..." : "Перемещение...";
  const rootCanBeSelected = allowCurrentTarget || !isCurrent(null);
  const selectedCanBeUsed =
    selected !== null &&
    !isExcluded(selected) &&
    (allowCurrentTarget || !isCurrent(selected));
  const canSelect =
    (isRootSelected && rootCanBeSelected) || selectedCanBeUsed;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCopyMode ? (
              <Copy className="h-5 w-5 text-primary" />
            ) : (
              <FolderInput className="h-5 w-5 text-primary" />
            )}
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {/* Root (Мои файлы) */}
          {(isCopyMode || currentFolderId !== null) && (
            <button
              type="button"
              onClick={() => {
                if (rootCanBeSelected) selectRoot();
              }}
              disabled={!rootCanBeSelected}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                isRootSelected
                  ? "bg-primary/10 text-primary"
                  : rootCanBeSelected
                  ? "text-foreground hover:bg-surface2/50"
                  : "cursor-not-allowed text-muted-foreground"
              )}
            >
              <Home className="h-4 w-4 shrink-0" />
              Мои файлы
            </button>
          )}

          {/* Folders */}
          {loadingRoots ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка папок...
            </div>
          ) : rootFolders.length === 0 && currentFolderId === null ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Нет доступных папок
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {rootFolders.map((folder) => {
                if (isExcluded(folder.id)) return null;
                const expanded = expandedIds.has(folder.id);
                const children = childrenMap[folder.id] ?? [];
                const loading = loadingChildren.has(folder.id);
                const current = isCurrent(folder.id);
                const disabledByCurrent = !allowCurrentTarget && current;

                return (
                  <li key={folder.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(folder.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <motion.span
                          animate={{ rotate: expanded ? 90 : 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </motion.span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!disabledByCurrent) selectFolder(folder.id);
                        }}
                        disabled={disabledByCurrent}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 py-3 pr-4 text-sm font-medium transition-colors",
                          disabledByCurrent
                            ? "cursor-not-allowed text-muted-foreground"
                            : selected === folder.id
                            ? "text-primary"
                            : "text-foreground hover:text-primary"
                        )}
                      >
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">{folder.name}</span>
                        {current && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">текущая</span>
                        )}
                      </button>
                    </div>

                    <AnimatePresence>
                      {expanded && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          {loading ? (
                            <li className="flex items-center gap-2 py-2 pl-12 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Загрузка...
                            </li>
                          ) : children.length === 0 ? (
                            <li className="py-2 pl-12 text-xs text-muted-foreground">
                              Нет подпапок
                            </li>
                          ) : (
                            children.map((child) => {
                              if (isExcluded(child.id)) return null;
                              const childCurrent = isCurrent(child.id);
                              const childDisabledByCurrent =
                                !allowCurrentTarget && childCurrent;
                              return (
                                <li key={child.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!childDisabledByCurrent) selectFolder(child.id);
                                    }}
                                    disabled={childDisabledByCurrent}
                                    className={cn(
                                      "flex w-full items-center gap-2 py-2.5 pl-12 pr-4 text-sm transition-colors",
                                      childDisabledByCurrent
                                        ? "cursor-not-allowed text-muted-foreground"
                                        : selected === child.id
                                        ? "bg-primary/5 font-medium text-primary"
                                        : "text-foreground hover:bg-surface2/50 hover:text-primary"
                                    )}
                                  >
                                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{child.name}</span>
                                    {childCurrent && (
                                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">текущая</span>
                                    )}
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={!canSelect || moving} className="gap-2">
            {moving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {submittingText}
              </>
            ) : (
              <>
                {isCopyMode ? (
                  <Copy className="h-4 w-4" />
                ) : (
                  <FolderInput className="h-4 w-4" />
                )}
                {submitText}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
