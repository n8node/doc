"use client";

import { motion } from "framer-motion";
import { FileText, MessageCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DocumentChatItem {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  messagesCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

interface DocumentChatCardProps {
  item: DocumentChatItem;
  index: number;
  onClick: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const timeLabel = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) {
    return `Сегодня ${timeLabel}`;
  }
  if (diffDays === 1) {
    return `Вчера ${timeLabel}`;
  }
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString("ru-RU", { weekday: "short" });
    return `${weekday} ${timeLabel}`;
  }
  const datePart = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${datePart} ${timeLabel}`;
}

export function DocumentChatCard({ item, index, onClick }: DocumentChatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          "cursor-pointer overflow-hidden transition-all duration-200",
          "border-border bg-surface shadow-soft hover:shadow-medium",
          "hover:border-cyan-500/30 hover:bg-cyan-500/5",
          "focus-within:ring-2 focus-within:ring-cyan-500/40 focus-within:ring-offset-2",
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="block w-full text-left focus:outline-none"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
                <FileText className="h-6 w-6 text-cyan-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatBytes(item.size)}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-cyan-600">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>
                    {item.messagesCount} {item.messagesCount === 1 ? "сообщение" : item.messagesCount < 5 ? "сообщения" : "сообщений"}
                    {item.lastMessageAt && ` • ${formatRelativeDate(item.lastMessageAt)}`}
                  </span>
                </div>
                {item.lastMessagePreview && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.lastMessagePreview}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </button>
      </Card>
    </motion.div>
  );
}
