"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { formatBytes, cn } from "@/lib/utils";
import {
  HardDrive,
  Crown,
  Zap,
  FileUp,
  ArrowUpRight,
  Check,
  Files,
} from "lucide-react";

interface StorageData {
  storageUsed: number;
  storageQuota: number;
  maxFileSize: number;
  filesCount: number;
  plan: {
    id: string;
    name: string;
    isFree: boolean;
  };
  nextPlan: {
    id: string;
    name: string;
    priceMonthly: number | null;
    storageQuota: number;
  } | null;
}

export function StorageWidget() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/storage")
      .then((r) => r.json())
      .then((d) => {
        if (d.storageUsed !== undefined) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-surface2/30 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-surface2" />
        <div className="h-3 w-full animate-pulse rounded-full bg-surface2" />
        <div className="h-3 w-32 animate-pulse rounded bg-surface2" />
      </div>
    );
  }

  if (!data) return null;

  const rawPercentage =
    data.storageQuota > 0
      ? Math.min((data.storageUsed / data.storageQuota) * 100, 100)
      : 0;

  const displayPercentage =
    rawPercentage === 0
      ? "0"
      : rawPercentage < 1
      ? rawPercentage.toFixed(2)
      : rawPercentage < 10
      ? rawPercentage.toFixed(1)
      : Math.round(rawPercentage).toString();

  const barWidth =
    data.storageUsed > 0 ? Math.max(rawPercentage, 1.5) : 0;

  const isWarning = rawPercentage > 80;
  const isCritical = rawPercentage > 95;
  const freeSpace = Math.max(0, data.storageQuota - data.storageUsed);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface2/30 p-4">
      {/* Plan name */}
      <Link
        href="/dashboard/plans"
        className="group flex items-center gap-2 transition-colors hover:text-primary"
      >
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg",
            data.plan.isFree ? "bg-success/10" : "bg-secondary/10"
          )}
        >
          {data.plan.isFree ? (
            <Zap className="h-3.5 w-3.5 text-success" />
          ) : (
            <Crown className="h-3.5 w-3.5 text-secondary" />
          )}
        </div>
        <span className="text-sm font-semibold">{data.plan.name}</span>
        <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>

      {/* Storage bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Хранилище</span>
          </div>
          <span className="text-xs font-medium">
            {formatBytes(data.storageUsed)}{" "}
            <span className="text-muted-foreground">
              / {formatBytes(data.storageQuota)}
            </span>
          </span>
        </div>

        <div className="relative h-2.5 overflow-hidden rounded-full bg-surface2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              isCritical
                ? "bg-error"
                : isWarning
                ? "bg-warning"
                : "bg-primary"
            )}
          />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span
            className={cn(
              "font-medium",
              isCritical
                ? "text-error"
                : isWarning
                ? "text-warning"
                : "text-muted-foreground"
            )}
          >
            {displayPercentage}%
          </span>
          <span className="text-muted-foreground">
            Свободно: {formatBytes(freeSpace)}
          </span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Files className="h-3 w-3" />
          {data.filesCount} файлов
        </span>
        <span className="flex items-center gap-1">
          <FileUp className="h-3 w-3" />
          до {formatBytes(data.maxFileSize)}
        </span>
      </div>

      {/* Warning */}
      {isWarning && (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-[11px] font-medium",
            isCritical
              ? "bg-error/10 text-error"
              : "bg-warning/10 text-warning"
          )}
        >
          {isCritical
            ? "Хранилище почти заполнено! Загрузка может быть ограничена."
            : "Хранилище заполнено более чем на 80%."}
        </div>
      )}

      {/* Upgrade / Max plan */}
      {data.nextPlan ? (
        <Link
          href="/dashboard/plans"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 px-3 py-2.5 text-xs font-medium text-primary transition-all hover:from-primary/20 hover:to-secondary/20"
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="flex-1">
            Улучшить до {data.nextPlan.name}
            {data.nextPlan.priceMonthly != null && (
              <span className="ml-1 text-muted-foreground">
                от {data.nextPlan.priceMonthly} ₽/мес
              </span>
            )}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-success/5 px-3 py-2.5 text-xs font-medium text-success">
          <Check className="h-3.5 w-3.5" />
          <span>Максимальный тариф</span>
        </div>
      )}
    </div>
  );
}
