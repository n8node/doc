"use client";

import { motion } from "framer-motion";
import { Home, ChevronRight, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  id: string | null;
  name: string;
}

interface BreadcrumbsProps {
  items: Breadcrumb[];
  onNavigate: (id: string | null) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto py-1">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <motion.div
            key={item.id ?? "root"}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center"
          >
            {!isFirst && (
              <ChevronRight className="mx-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              disabled={isLast}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-all",
                isLast
                  ? "cursor-default text-foreground"
                  : "text-muted-foreground hover:bg-surface2 hover:text-foreground"
              )}
            >
              {isFirst ? (
                <Home className="h-4 w-4" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[120px] truncate">{item.name}</span>
            </button>
          </motion.div>
        );
      })}
    </nav>
  );
}
