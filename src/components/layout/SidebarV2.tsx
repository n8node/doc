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
      className="fixed left-0 top-0 z-40 h-screen w-72 p-3"
    >
      <div className="modal-glass flex h-full flex-col overflow-hidden rounded-3xl border border-border/70">
        <div className="flex h-20 items-center gap-3 border-b border-border/70 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-glow">
            <HardDrive className="h-5 w-5 text-white drop-shadow" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-foreground">qoqon.ru</p>
            <p className="text-xs text-muted-foreground">Новая навигация (beta)</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          <div className="space-y-1.5">
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
                      "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.85)]"
                        : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.16)]" />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1.5">
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
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.85)]"
                        : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground"
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

        <div className="space-y-1 border-t border-border/70 px-3 py-4">
          <Link href="/dashboard/settings">
            <motion.div
              whileHover={{ x: 4 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                pathname === "/dashboard/settings"
                  ? "bg-primary/15 text-primary ring-1 ring-primary/35"
                  : "text-muted-foreground hover:bg-surface2/75 hover:text-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Настройки</span>
            </motion.div>
          </Link>
          <Link href="/api/auth/signout">
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface2/75 hover:text-foreground"
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
