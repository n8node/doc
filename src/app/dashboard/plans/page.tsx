"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Crown, Loader2 } from "lucide-react";
import { PlansPricingGrid } from "@/components/plans/PlansPricingGrid";
import type { PlanItem } from "@/components/plans/plan-pricing-types";

/** Ответ GET /api/v1/plans/me — бейдж и расход транскрибации */
interface CurrentPlanMe {
  id: string;
  name: string;
  storageQuota: number;
  maxFileSize: number;
  features: Record<string, boolean>;
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
  transcriptionMinutesUsedThisMonth?: number;
  transcriptionAudioMinutesUsedThisMonth?: number;
  transcriptionVideoMinutesUsedThisMonth?: number;
}

export default function DashboardPlansPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      toast.success("Оплата прошла успешно! Тариф активирован.");
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/plans").then((r) => r.json()),
      fetch("/api/v1/plans/me").then((r) => r.json()),
    ])
      .then(([plansData, meData]) => {
        setPlans(plansData.plans ?? []);
        setCurrentPlan(meData);
      })
      .catch(() => toast.error("Ошибка загрузки тарифов"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planId: string, period: "monthly" | "yearly" = "monthly") => {
    setSubscribing(planId);
    try {
      const res = await fetch("/api/v1/plans/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, period }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.requiresPayment && data.confirmationUrl) {
          window.location.href = data.confirmationUrl;
          return;
        }
        toast.success(`Тариф "${data.plan.name}" активирован!`);
        const meRes = await fetch("/api/v1/plans/me");
        const meData = await meRes.json();
        setCurrentPlan(meData);
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка подключения тарифа");
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Тарифные планы</h1>
          <p className="mt-2 text-muted-foreground">Выберите тариф, который подходит именно вам</p>
        </motion.div>

        {currentPlan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Crown className="h-4 w-4" />
              Текущий тариф: {currentPlan.name}
            </div>
          </motion.div>
        )}
      </div>

      <PlansPricingGrid
        mode="dashboard"
        plans={plans}
        currentPlanId={currentPlan?.id ?? null}
        subscribing={subscribing}
        onSubscribe={handleSubscribe}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-sm text-muted-foreground">
          Тариф можно сменить в любой момент. При переходе на более дорогой тариф ваши файлы и настройки сохраняются.
          Квота и лимиты обновляются мгновенно.
        </p>
      </motion.div>
    </div>
  );
}
