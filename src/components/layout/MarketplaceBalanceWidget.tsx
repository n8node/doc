"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

export function MarketplaceBalanceWidget() {
  const [loading, setLoading] = useState(true);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/user/llm-wallet", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.balanceCents === "number") {
          setBalanceCents(data.balanceCents);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const rub = loading ? null : (balanceCents ?? 0) / 100;
  const display =
    rub == null ? "..." : Number.isInteger(rub) ? String(rub) : rub.toFixed(2);

  return (
    <Link
      href="/dashboard/marketplace"
      className="hidden md:flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity"
      title="API маркетплейс"
    >
      <Coins className="h-5 w-5 text-amber-500" />
      <span className="font-semibold text-sm">{display}</span>
    </Link>
  );
}
