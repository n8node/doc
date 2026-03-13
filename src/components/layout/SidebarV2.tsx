"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Upload,
  Settings,
  LogOut,
  HardDrive,
  LayoutDashboard,
  Crown,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { SidebarDropZone } from "@/components/files/SidebarDropZone";
import {
  buildDashboardFilesUrl,
  parseFilesSection,
} from "@/lib/files-navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  navGroups,
  resolveModulePrefs,
  isGroupVisible,
  type ModuleId,
} from "@/lib/modules";

export function SidebarV2() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [branding, setBranding] = useState<{
    siteName: string;
    logoUrl: string | null;
    sidebarSubtitle: string;
  }>({
    siteName: "qoqon.ru",
    logoUrl: null,
    sidebarSubtitle: "Облачное хранилище",
  });

  const [modulePrefs, setModulePrefs] = useState<Record<ModuleId, boolean>>({
    storage: true,
    ai_tools: true,
    generation: true,
    integrations: true,
  });
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("sidebar-collapsed") ?? "{}");
    } catch {
      return {};
    }
  });

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
      return next;
    });
  }, []);

  const activeSection = parseFilesSection(searchParams.get("section"));
  const isFilesPage =
    pathname === "/dashboard/files" || pathname.startsWith("/dashboard/files");

  useEffect(() => {
    fetch("/api/public/branding")
      .then((r) => r.json())
      .then((data) => {
        setBranding({
          siteName:
            typeof data.siteName === "string" && data.siteName.trim()
              ? data.siteName.trim()
              : "qoqon.ru",
          logoUrl:
            typeof data.logoUrl === "string" && data.logoUrl
              ? data.logoUrl
              : null,
          sidebarSubtitle:
            typeof data.sidebarSubtitle === "string" &&
            data.sidebarSubtitle.trim()
              ? data.sidebarSubtitle.trim()
              : "Облачное хранилище",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/user/preferences", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/v1/plans/me", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([prefs, plan]) => {
      setModulePrefs(resolveModulePrefs(prefs.modules));
      if (plan.features && typeof plan.features === "object") {
        setPlanFeatures(plan.features as Record<string, boolean>);
      }
    });
  }, []);

  const handleUploadClick = () => {
    if (isFilesPage && activeSection === "my-files") {
      window.dispatchEvent(new CustomEvent("files:open-upload-dialog"));
      return;
    }
    router.push(
      buildDashboardFilesUrl({ section: "my-files", intent: "upload" }),
    );
  };

  const visibleGroups = navGroups.filter((g) =>
    isGroupVisible(g, modulePrefs, planFeatures),
  );

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 z-40 h-screen w-[291px] p-3"
    >
      <div className="modal-glass flex h-full flex-col overflow-hidden rounded-3xl border border-border/70">
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-border/70 px-6">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="logo"
              className="h-11 w-11 rounded-2xl border border-border/70 bg-background object-contain p-1"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-glow">
              <HardDrive className="h-5 w-5 text-white drop-shadow" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-foreground">
              {branding.siteName}
            </p>
            <p className="text-xs text-muted-foreground">
              {branding.sidebarSubtitle}
            </p>
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-3 px-4 pt-4">
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Upload className="h-4 w-4" />
            Загрузить
          </button>
          <SidebarDropZone />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5">
          {/* Dashboard */}
          <div className="space-y-1.5">
            <Link href="/dashboard">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  pathname === "/dashboard"
                    ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/35 shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.85)]"
                    : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground",
                )}
              >
                <LayoutDashboard
                  className={cn(
                    "h-5 w-5",
                    pathname === "/dashboard" && "text-primary",
                  )}
                />
                <span className="flex-1">Дашборд</span>
                {pathname === "/dashboard" && (
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.16)]" />
                )}
              </motion.div>
            </Link>
          </div>

          {/* Module groups */}
          {visibleGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleCollapse(group.id)}
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border-l-2 border-primary/40 px-4 py-2 bg-surface2/30 group hover:bg-surface2/50 transition-colors"
              >
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground/90">
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                    collapsed[group.id] && "-rotate-90",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {!collapsed[group.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden py-1.5"
                  >
                    {group.items.map((item) => {
                      const isFileSection =
                        item.section &&
                        isFilesPage &&
                        activeSection === item.section;
                      const isRouteActive =
                        !item.section &&
                        (pathname === item.href ||
                          pathname.startsWith(item.href + "/"));
                      const isActive = isFileSection || isRouteActive;
                      return (
                        <Link key={item.href} href={item.href}>
<motion.div
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "relative flex items-center gap-3 rounded-2xl border-l-2 border-transparent px-4 py-3 text-sm font-medium transition-all duration-200",
                                              isActive
                                ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/35 shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.85)]"
                                : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5",
                                isActive && "text-primary",
                              )}
                            />
                            <span className="flex-1">{item.label}</span>
                            {isActive && (
                              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.16)]" />
                            )}
                          </motion.div>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Plans — always visible */}
          <div className="space-y-1.5">
            <Link href="/dashboard/plans">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  pathname === "/dashboard/plans"
                    ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/35 shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.85)]"
                    : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground",
                )}
              >
                <Crown
                  className={cn(
                    "h-5 w-5",
                    pathname === "/dashboard/plans" && "text-primary",
                  )}
                />
                <span className="flex-1">Тарифы</span>
              </motion.div>
            </Link>
          </div>
        </nav>

        {/* Storage widget */}
        <div className="px-4 pb-4">
          <StorageWidget />
        </div>

        {/* Footer */}
        <div className="space-y-1 border-t border-border/70 px-4 py-4">
          <Link href="/dashboard/settings">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard/settings"
                  ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/35"
                  : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground",
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Настройки</span>
            </motion.div>
          </Link>
          <LogoutButton className="w-full text-left">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface2/75 hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span>Выйти</span>
            </motion.div>
          </LogoutButton>
        </div>
      </div>
    </motion.aside>
  );
}
