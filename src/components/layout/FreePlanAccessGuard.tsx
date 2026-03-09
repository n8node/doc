"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type PlanMeResponse = {
  freePlanTimer?: {
    isExpired: boolean;
  } | null;
};

export function FreePlanAccessGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const res = await fetch("/api/v1/plans/me", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as PlanMeResponse;
        const isExpired = data?.freePlanTimer?.isExpired === true;
        const isPlansPage = pathname?.startsWith("/dashboard/plans");
        if (isExpired && !isPlansPage) {
          router.replace("/dashboard/plans?freeExpired=1");
        }
      } catch {
        // silent guard
      }
    };

    void check();
    const interval = setInterval(() => void check(), 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
