"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Search,
  Settings,
  LogOut,
  HardDrive,
  Crown,
} from "lucide-react";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { SidebarFolderTree } from "./SidebarFolderTree";

const navItems = [
  { href: "/dashboard/files", icon: FolderOpen, label: "Файлы" },
  { href: "/dashboard/search", icon: Search, label: "Поиск" },
  { href: "/dashboard/plans", icon: Crown, label: "Тарифы" },
];

export function Sidebar() {
  const pathname = usePathname();

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
          <span className="text-lg font-bold text-foreground">
            qoqon.ru
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
