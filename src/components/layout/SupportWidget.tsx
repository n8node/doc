"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Headphones } from "lucide-react";

function fetchAwaitingCount(setCount: (n: number) => void) {
  fetch("/api/v1/support/tickets/count", { credentials: "include" })
    .then((r) => r.json())
    .then((d: { awaitingUserCount?: number }) => setCount(d?.awaitingUserCount ?? 0))
    .catch(() => setCount(0));
}

export function SupportWidget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchAwaitingCount(setCount);
    const interval = setInterval(() => fetchAwaitingCount(setCount), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/dashboard/support"
      className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
      aria-label="Поддержка"
    >
      <Headphones className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
