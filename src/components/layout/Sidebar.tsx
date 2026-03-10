"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Search,
  MessageCircle,
  Settings,
  LogOut,
  HardDrive,
  Crown,
  Database,
  BrainCircuit,
  LayoutDashboard,
} from "lucide-react";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { SidebarFolderTree } from "./SidebarFolderTree";
import { buildDashboardFilesUrl, DEFAULT_FILES_SECTION } from "@/lib/files-navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
  { href: buildDashboardFilesUrl({ section: DEFAULT_FILES_SECTION }), icon: FolderOpen, label: "Файлы" },
  { href: "/dashboard/search", icon: Search, label: "Поиск" },
  { href: "/dashboard/rag-memory", icon: BrainCircuit, label: "RAG-память" },
  { href: "/dashboard/embeddings", icon: Database, label: "Векторная база" },
  { href: "/dashboard/document-chats", icon: MessageCircle, label: "AI чаты по документам" },
  { href: "/dashboard/plans", icon: Crown, label: "Тарифы" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [branding, setBranding] = useState<{ siteName: string; logoUrl: string | null }>({
    siteName: "qoqon.ru",
    logoUrl: null,
  });

  useEffect(() => {
    fetch("/api/public/branding")
      .then((r) => r.json())
      .then((data) => {
        setBranding({
          siteName: typeof data.siteName === "string" && data.siteName.trim() ? data.siteName.trim() : "qoqon.ru",
          logoUrl: typeof data.logoUrl === "string" && data.logoUrl ? data.logoUrl : null,
        });
      })
      .catch(() => {});
  }, []);

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
            <img src={branding.logoUrl} alt="logo" className="h-10 w-10 rounded-xl border border-border bg-background object-contain p-1" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow">
              <HardDrive className="h-5 w-5 text-white" />
            </div>
          )}
          <span className="text-lg font-bold text-foreground">
            {branding.siteName}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-soft"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn("h-5 w-5", isActive && "text-primary")}
                  />
                  <span className="flex-1">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
          <SidebarFolderTree />
        </nav>

        <div className="px-4 pb-4">
          <StorageWidget />
        </div>

        <div className="space-y-1 border-t border-border px-3 py-4">
          <Link href="/dashboard/settings">
            <motion.div
              whileHover={{ x: 4 }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
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
