"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  X,
  Crown,
  Zap,
  HardDrive,
  FileUp,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";

interface PlanItem {
  id: string;
  name: string;
  isFree: boolean;
  isPopular: boolean;
  storageQuota: number;
  maxFileSize: number;
  features: Record<string, boolean>;
  aiAnalysisDocumentsQuota?: number | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  trashRetentionDays: number;
}

interface UserPlan {
  id: string;
  name: string;
  storageQuota: number;
  maxFileSize: number;
  features: Record<string, boolean>;
}

const featureLabels: Record<string, string> = {
  video_player: "Встроенный видеоплеер",
  audio_player: "Встроенный аудиоплеер",
  share_links: "Публичные ссылки",
  folder_share: "Шаринг папок",
  ai_search: "AI-поиск по документам",
  document_chat: "AI чаты по документам",
  document_analysis: "AI-анализ документов",
};

export default function DashboardPlansPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
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

  const isCurrent = (planId: string) => currentPlan?.id === planId;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-foreground">Тарифные планы</h1>
          <p className="mt-2 text-muted-foreground">
            Выберите тариф, который подходит именно вам
          </p>
        </motion.div>

        {/* Current plan badge */}
        {currentPlan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
          >
            <Crown className="h-4 w-4" />
            Текущий тариф: {currentPlan.name}
          </motion.div>
        )}
      </div>

      {/* Plans grid */}
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const current = isCurrent(plan.id);
          const isPopular = plan.isPopular;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`relative flex h-full flex-col overflow-hidden transition-all duration-300 ${
                  current
                    ? "border-2 border-primary shadow-glow"
                    : isPopular
                    ? "border-2 border-secondary/50 hover:border-secondary hover:shadow-lg"
                    : "hover:shadow-lg"
                }`}
              >
                {/* Popular badge */}
                {isPopular && !current && (
                  <div className="absolute right-0 top-0">
                    <div className="flex items-center gap-1 rounded-bl-xl bg-secondary px-3 py-1 text-xs font-medium text-white">
                      <Sparkles className="h-3 w-3" />
                      Популярный
                    </div>
                  </div>
                )}

                {/* Current badge */}
                {current && (
                  <div className="absolute right-0 top-0">
                    <div className="flex items-center gap-1 rounded-bl-xl bg-primary px-3 py-1 text-xs font-medium text-white">
                      <Check className="h-3 w-3" />
                      Ваш тариф
                    </div>
                  </div>
                )}

                {/* Plan header */}
                <div className="p-6 pb-4">
                  <div className="mb-4">
                    <div className="mb-1 flex items-center gap-2">
                      {plan.isFree ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                          <Zap className="h-5 w-5 text-success" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                          <Crown className="h-5 w-5 text-secondary" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    {plan.isFree ? (
                      <p className="text-3xl font-bold text-success">0 ₽</p>
                    ) : plan.priceMonthly != null ? (
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {plan.priceMonthly} ₽
                          <span className="text-base font-normal text-muted-foreground">
                            /мес
                          </span>
                        </p>
                        {plan.priceYearly != null && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            или {plan.priceYearly} ₽/год{" "}
                            {plan.priceMonthly > 0 && (
                              <Badge variant="success" className="ml-1">
                                -{Math.round(100 - (plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%
                              </Badge>
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-lg text-muted-foreground">Цена по запросу</p>
                    )}
                  </div>
                </div>

                {/* Quotas */}
                <div className="space-y-3 border-t border-border px-6 py-4">
                  <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="h-4 w-4 text-primary" />
                    <span>
                      <strong>{formatBytes(plan.storageQuota)}</strong> хранилище
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <FileUp className="h-4 w-4 text-primary" />
                    <span>
                      Файлы до <strong>{formatBytes(plan.maxFileSize)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Trash2 className="h-4 w-4 text-primary" />
                    <span>
                      {plan.trashRetentionDays > 0 ? (
                        <>Корзина: <strong>{plan.trashRetentionDays} дн.</strong></>
                      ) : (
                        <span className="text-muted-foreground">Без корзины</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-2 border-t border-border px-6 py-4">
                  {Object.entries(featureLabels).map(([key, label]) => {
                    const enabled = !!plan.features?.[key];
                    return (
                      <div key={key} className="flex items-center gap-3 text-sm">
                        {enabled ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10">
                            <Check className="h-3 w-3 text-success" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface2">
                            <X className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className={enabled ? "text-foreground" : "text-muted-foreground"}>
                          {label}
                          {key === "document_analysis" && enabled && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({plan.aiAnalysisDocumentsQuota != null
                                ? `${plan.aiAnalysisDocumentsQuota} док./мес`
                                : "безлимит"})
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action */}
                <div className="border-t border-border p-6 pt-4 space-y-2">
                  {current ? (
                    <Button disabled className="w-full" variant="outline">
                      <Check className="mr-2 h-4 w-4" />
                      Текущий тариф
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => handleSubscribe(plan.id, "monthly")}
                        disabled={subscribing === plan.id}
                      >
                        {subscribing === plan.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Подключение...
                          </>
                        ) : plan.isFree ? (
                          "Выбрать бесплатный"
                        ) : (
                          `Подключить за ${plan.priceMonthly ?? "?"} ₽/мес`
                        )}
                      </Button>
                      {!plan.isFree && plan.priceYearly != null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-foreground"
                          onClick={() => handleSubscribe(plan.id, "yearly")}
                          disabled={subscribing === plan.id}
                        >
                          или {plan.priceYearly} ₽/год
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-sm text-muted-foreground">
          Тариф можно сменить в любой момент. При переходе на более дорогой тариф
          ваши файлы и настройки сохраняются. Квота и лимиты обновляются мгновенно.
        </p>
      </motion.div>
    </div>
  );
}
