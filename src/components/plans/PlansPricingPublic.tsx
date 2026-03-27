"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PlansPricingGrid } from "./PlansPricingGrid";
import type { PlanItem } from "./plan-pricing-types";

interface PlansPricingPublicProps {
  /** Заголовок секции: на главной — h2, на отдельной странице — h1 */
  headingLevel?: "h1" | "h2";
}

export function PlansPricingPublic({ headingLevel = "h2" }: PlansPricingPublicProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/plans")
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => toast.error("Не удалось загрузить тарифы"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const titleClass =
    headingLevel === "h1"
      ? "text-3xl font-bold text-foreground sm:text-4xl"
      : "text-2xl font-bold text-foreground sm:text-3xl";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {headingLevel === "h1" ? (
          <h1 className={titleClass}>Тарифные планы</h1>
        ) : (
          <h2 className={titleClass}>Тарифные планы</h2>
        )}
      </motion.div>

      <div className="mt-10">
        <PlansPricingGrid mode="public" plans={plans} />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground"
      >
        Уже есть аккаунт?{" "}
        <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Войти
        </a>
        . Тариф можно сменить в любой момент в кабинете; квота и лимиты обновляются после оплаты.
      </motion.p>
    </>
  );
}
