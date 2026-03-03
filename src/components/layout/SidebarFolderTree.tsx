"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FolderOpen, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildDashboardFilesUrl,
  DEFAULT_FILES_SECTION,
  parseFilesSection,
} from "@/lib/files-navigation";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

export function SidebarFolderTree() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folderIdParam = searchParams.get("folderId") ?? null;
  const activeSection = parseFilesSection(searchParams.get("section"));
  const isMyFilesSection = activeSection === DEFAULT_FILES_SECTION;

  const [rootFolders, setRootFolders] = useState<FolderItem[]>([]);
  const [childrenByParentId, setChildrenByParentId] = useState<Record<string, FolderItem[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingRoots, setLoadingRoots] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [pathSecondLevelId, setPathSecondLevelId] = useState<string | null>(null);

  const isFilesPage = pathname === "/dashboard/files" || pathname.startsWith("/dashboard/files");

  const loadRootFolders = useCallback(async () => {
    setLoadingRoots(true);
    try {
      const res = await fetch("/api/folders?parentId=");
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders)) {
        setRootFolders(data.folders);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRoots(false);
    }
  }, []);

  const loadChildren = useCallback(async (parentId: string) => {
    setLoadingChildren((prev) => new Set(prev).add(parentId));
    try {
      const res = await fetch(`/api/folders?parentId=${encodeURIComponent(parentId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders)) {
        setChildrenByParentId((prev) => ({ ...prev, [parentId]: data.folders }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingChildren((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (isFilesPage) loadRootFolders();
  }, [isFilesPage, loadRootFolders]);

  useEffect(() => {
    if (!folderIdParam || !isFilesPage) {
      setPathSecondLevelId(null);
      return;
    }
    fetch(`/api/folders/${folderIdParam}/path`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.path) && data.path.length > 0) {
          const rootId = data.path[0].id;
          const secondId = data.path.length > 1 ? data.path[1].id : null;
          setPathSecondLevelId(secondId);
          setExpandedIds((prev) => new Set(prev).add(rootId));
          loadChildren(rootId);
        } else {
          setPathSecondLevelId(null);
        }
      })
      .catch(() => setPathSecondLevelId(null));
  }, [folderIdParam, isFilesPage, loadChildren]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!childrenByParentId[id]) loadChildren(id);
  };

  const isActive = (id: string | null) => {
    if (!isMyFilesSection) return false;
    if (folderIdParam === null && id === null) return true;
    if (folderIdParam === id) return true;
    if (id !== null && id === pathSecondLevelId && folderIdParam !== pathSecondLevelId)
      return true;
    return false;
  };

  if (!isFilesPage || !isMyFilesSection) return null;

  return (
    <div className="space-y-0.5 px-1">
      <div className="mb-2 mt-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Папки
      </div>

      <Link
        href={buildDashboardFilesUrl({ section: DEFAULT_FILES_SECTION })}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          isActive(null)
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-surface hover:text-foreground"
        )}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="truncate">Мои файлы</span>
      </Link>

      {loadingRoots ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Загрузка…</span>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {rootFolders.map((folder) => {
            const expanded = expandedIds.has(folder.id);
            const children = childrenByParentId[folder.id] ?? [];
            const loading = loadingChildren.has(folder.id);
            const isRootActive = isActive(folder.id);

            return (
              <li key={folder.id} className="list-none">
                <div className="flex items-center gap-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => toggleExpand(folder.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    aria-expanded={expanded}
                  >
                    <motion.span
                      animate={{ rotate: expanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <Link
                    href={buildDashboardFilesUrl({
                      section: DEFAULT_FILES_SECTION,
                      folderId: folder.id,
                    })}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-all",
                      isRootActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </Link>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-6"
                    >
                      {loading ? (
                        <li className="flex items-center gap-2 py-1.5 pl-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Загрузка…
                        </li>
                      ) : (
                        children.map((child) => {
                          const isChildActive = isActive(child.id);
                          return (
                            <li key={child.id} className="list-none">
                              <Link
                                href={buildDashboardFilesUrl({
                                  section: DEFAULT_FILES_SECTION,
                                  folderId: child.id,
                                })}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                                  isChildActive
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                )}
                              >
                                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{child.name}</span>
                              </Link>
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
  );
}
