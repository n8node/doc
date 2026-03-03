"use client";

import { motion } from "framer-motion";
import { formatBytes } from "@/lib/utils";
import { HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageWidgetProps {
  used?: bigint;
  total?: bigint;
}

export function StorageWidget({
  used = BigInt(5368709120),
  total = BigInt(10737418240),
}: StorageWidgetProps) {
  const percentage = Number((used * BigInt(100)) / total);
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="glass-subtle space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Хранилище</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatBytes(Number(used))} / {formatBytes(Number(total))}
        </span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-surface2">
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: `${percentage}%`,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full shadow-glow",
            isCritical ? "bg-error" : isWarning ? "bg-warning" : "bg-primary"
          )}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            isCritical ? "text-error" : isWarning ? "text-warning" : "text-primary"
          )}
        >
          {percentage}% использовано
        </span>
      </div>
    </div>
  );
}
