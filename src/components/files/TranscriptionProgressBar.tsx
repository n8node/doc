"use client";

import { useEffect, useState } from "react";
import { Mic2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessingProgressBarProps {
  /** Timestamp when processing started (ms) */
  startTimestamp: number;
  /** Estimated processing time in seconds */
  estimatedSeconds: number;
  /** Compact (list) or default (card) layout */
  variant?: "compact" | "default";
  className?: string;
  /** Label: "Транскрипция" | "Анализ" */
  label?: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Tailwind color: "amber" | "emerald" */
  color?: "amber" | "emerald";
}

/**
 * Детерминированный прогресс-бар: заполняется от 0% до 100% за estimatedSeconds.
 */
export function TranscriptionProgressBar({
  startTimestamp,
  estimatedSeconds,
  variant = "default",
  className,
  label = "Транскрипция",
  icon: Icon = Mic2,
  color = "amber",
}: ProcessingProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (estimatedSeconds <= 0) return;

    const tick = () => {
      const elapsed = (Date.now() - startTimestamp) / 1000;
      const p = Math.min(100, Math.round((elapsed / estimatedSeconds) * 100));
      setProgress(p);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTimestamp, estimatedSeconds]);

  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));

  if (variant === "compact") {
    return (
      <span
        className={cn("flex items-center gap-2", color === "emerald" ? "text-emerald-500" : "text-amber-500", className)}
        title={`${label} (~${estimatedMinutes} мин)`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs">{label} (~{estimatedMinutes} мин)</span>
        <div
          className={cn(
            "h-1.5 w-16 min-w-16 overflow-hidden rounded-full",
            color === "emerald" ? "bg-emerald-500/20" : "bg-amber-500/20"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              color === "emerald" ? "bg-emerald-500" : "bg-amber-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "flex items-center gap-2",
          color === "emerald" ? "text-emerald-500" : "text-amber-500"
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-xs">{label} (~{estimatedMinutes} мин)</span>
      </div>
      <div
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full",
          color === "emerald" ? "bg-emerald-500/20" : "bg-amber-500/20"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            color === "emerald" ? "bg-emerald-500" : "bg-amber-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
