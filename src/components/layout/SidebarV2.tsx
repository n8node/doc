"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import {
  FolderOpen,
  ImageIcon,
  Share2,
  History,
  Clock3,
  Search,
  Crown,
  Settings,
  LogOut,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import {
  buildDashboardFilesUrl,
  parseFilesSection,
  type FilesSection,
} from "@/lib/files-navigation";

type SectionItem = {
  section: FilesSection;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

const sectionItems: SectionItem[] = [
  { section: "my-files", icon: FolderOpen, label: "Мои файлы" },
  { section: "recent", icon: Clock3, label: "Недавние" },
  { section: "photos", icon: ImageIcon, label: "Фото" },
  { section: "shared", icon: Share2, label: "Общий доступ" },
  { section: "history", icon: History, label: "История" },
];

const extraNavItems = [
  { href: "/dashboard/search", icon: Search, label: "Поиск" },
  { href: "/dashboard/plans", icon: Crown, label: "Тарифы" },
];

export function SidebarV2() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = parseFilesSection(searchParams.get("section"));
  const isFilesPage = pathname === "/dashboard/files" || pathname.startsWith("/dashboard/files");

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 z-40 h-screen w-72 border-r border-border glass-strong"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-18 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow">
            <HardDrive className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-foreground">qoqon.ru</p>
            <p className="text-xs text-muted-foreground">Sidebar v2 (beta)</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-6">
          <div className="space-y-1">
            <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Файлы
            </p>
            {sectionItems.map((item) => {
              const isActive = isFilesPage && activeSection === item.section;
              const href = buildDashboardFilesUrl({ section: item.section });
              return (
                <Link key={item.section} href={href}>
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
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    <span className="flex-1">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1">
            <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Инструменты
            </p>
            {extraNavItems.map((item) => {
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
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    <span className="flex-1">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
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
          <Link href="/api/auth/signout">
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span>Выйти</span>
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.aside>
  );
}
