"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Loader2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function MarketplaceBalanceWidget() {
  const [loading, setLoading] = useState(true);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("100");
  const [topupLoading, setTopupLoading] = useState(false);

  const loadBalance = () => {
    fetch("/api/v1/user/llm-wallet", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.balanceCents === "number") {
          setBalanceCents(data.balanceCents);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const rub = loading ? null : (balanceCents ?? 0) / 100;
  const display =
    rub == null ? "..." : Number.isInteger(rub) ? String(rub) : rub.toFixed(2);

  const handleTopup = async () => {
    const rubNum = parseInt(topupAmount, 10);
    if (Number.isNaN(rubNum) || rubNum < 10) {
      toast.error("Минимальная сумма — 10 ₽");
      return;
    }
    setTopupLoading(true);
    try {
      const res = await fetch("/api/v1/user/llm-wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: rubNum * 100 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка пополнения");
        return;
      }
      if (data.confirmationUrl) {
        setOpen(false);
        window.location.href = data.confirmationUrl;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка пополнения");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity"
        title="Пополнить кошелёк"
      >
        <Coins className="h-5 w-5 text-amber-500" />
        <span className="font-semibold text-sm">{display}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby="wallet-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-500" />
              Пополнение кошелька
            </DialogTitle>
            <DialogDescription id="wallet-desc" className="text-left">
              Средства используются для <strong>API‑маркетплейса</strong> (чат, эмбеддинги, поиск) и для
              <strong> доплаты за генерацию медиа</strong> (изображения, в будущем — видео) при исчерпании квоты по тарифу.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Сумма, ₽</label>
              <Input
                type="number"
                min={10}
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="100"
                className="max-w-[140px]"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleTopup} disabled={topupLoading}>
                {topupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Пополнить
              </Button>
              <Link
                href="/dashboard/marketplace"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline" })}
              >
                Перейти в API маркетплейс
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
