"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Hourglass } from "lucide-react";

type PlanMeResponse = {
  freePlanTimer?: {
    durationDays: number;
    expiresAt: string;
    remainingDays: number;
    remainingMs: number;
    isExpired: boolean;
  } | null;
};

function formatRemainingDays(remainingDays: number) {
  if (remainingDays <= 0) return "0 дн.";
  if (remainingDays < 1) return "< 1 дн.";
  return `${Math.ceil(remainingDays)} дн.`;
}

export function FreePlanTimerWidget() {
  const [data, setData] = useState<PlanMeResponse | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/v1/plans/me", { cache: "no-store" });
        const payload = (await res.json()) as PlanMeResponse;
        if (!alive) return;
        if (res.ok) setData(payload);
      } catch {
        if (alive) setData(null);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const timer = data?.freePlanTimer ?? null;
  const toneClass = useMemo(() => {
    if (!timer) return "";
    if (timer.isExpired) {
      return "border-red-400/80 bg-gradient-to-r from-red-500/20 to-rose-500/15 text-slate-900 dark:text-red-50";
    }
    if (timer.remainingDays <= 3) {
      return "border-amber-400/80 bg-gradient-to-r from-amber-400/20 to-orange-400/15 text-slate-900 dark:text-amber-50";
    }
    return "border-sky-400/80 bg-gradient-to-r from-sky-400/20 to-cyan-400/15 text-slate-900 dark:text-cyan-50";
  }, [timer]);

  if (!timer) return null;

  return (
    <Link
      href="/dashboard/plans"
      className={`hidden md:flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition-all hover:scale-[1.01] ${toneClass}`}
      title={
        timer.isExpired
          ? "Срок бесплатного тарифа истек. Перейдите в тарифы."
          : "Остаток бесплатного тарифа"
      }
    >
      <Hourglass className="h-4 w-4" />
      <span className="leading-tight">
        {timer.isExpired
          ? "Бесплатный тариф истек"
          : `Осталось: ${formatRemainingDays(timer.remainingDays)}`}
      </span>
    </Link>
  );
}
