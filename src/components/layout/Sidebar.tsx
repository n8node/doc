"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Settings,
  LogOut,
  HardDrive,
  LayoutDashboard,
  Crown,
  ChevronDown,
} from "lucide-react";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { SidebarFolderTree } from "./SidebarFolderTree";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  navGroups,
  resolveModulePrefs,
  isGroupVisible,
  type ModuleId,
} from "@/lib/modules";

export function Sidebar() {
  const pathname = usePathname();
  const [branding, setBranding] = useState<{
    siteName: string;
    logoUrl: string | null;
  }>({
    siteName: "qoqon.ru",
    logoUrl: null,
  });

  const [modulePrefs, setModulePrefs] = useState<Record<ModuleId, boolean>>({
    storage: true,
    ai_tools: true,
    generation: true,
    integrations: true,
    tools: true,
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

  const visibleGroups = navGroups.filter((g) =>
    isGroupVisible(g, modulePrefs, planFeatures),
  );

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 z-40 h-screen w-72 border-r border-border glass-strong"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-18 items-center gap-3 border-b border-border px-6">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="logo"
              className="h-10 w-10 rounded-xl border border-border bg-background object-contain p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow">
              <HardDrive className="h-5 w-5 text-white" />
            </div>
          )}
          <span className="text-lg font-bold text-foreground">
            {branding.siteName}
          </span>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-6">
          {/* Dashboard */}
          <Link href="/dashboard">
            <motion.div
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard"
                  ? "bg-primary/10 text-primary shadow-soft"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <LayoutDashboard
                className={cn(
                  "h-5 w-5",
                  pathname === "/dashboard" && "text-primary",
                )}
              />
              <span className="flex-1">Дашборд</span>
            </motion.div>
          </Link>

          {/* Module groups */}
          {visibleGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCollapse(group.id)}
                className="flex w-full items-center justify-between px-4 pb-1 group"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground",
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
                    className="overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                      return (
                        <Link key={item.href} href={item.href}>
                          <motion.div
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-primary/10 text-primary shadow-soft"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5",
                                isActive && "text-primary",
                              )}
                            />
                            <span className="flex-1">{item.label}</span>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <SidebarFolderTree />
        </nav>

        <div className="px-4 pb-4">
          <StorageWidget />
        </div>

        <div className="space-y-1 border-t border-border px-3 py-4">
          <Link href="/dashboard/plans">
            <motion.div
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard/plans"
                  ? "bg-primary/10 text-primary shadow-soft"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
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
          <Link href="/dashboard/settings">
            <motion.div
              whileHover={{ x: 4 }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Настройки</span>
            </motion.div>
          </Link>
          <LogoutButton className="w-full text-left">
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface hover:text-foreground"
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
