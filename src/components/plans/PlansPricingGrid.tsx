"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, cn } from "@/lib/utils";
import type { PlanItem } from "./plan-pricing-types";
import {
  getPlanFeatureTooltipContent,
  isPlanFeatureEnabled,
  planFeatureLabels,
} from "./plan-pricing-shared";

interface PlansPricingGridProps {
  mode: "dashboard" | "public";
  plans: PlanItem[];
  currentPlanId?: string | null;
  subscribing?: string | null;
  onSubscribe?: (planId: string, period: "monthly" | "yearly") => void;
}

export function PlansPricingGrid({
  mode,
  plans,
  currentPlanId,
  subscribing,
  onSubscribe,
}: PlansPricingGridProps) {
  const isCurrent = (planId: string) => currentPlanId === planId;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              {isPopular && !current && (
                <div className="absolute right-0 top-0">
                  <div className="flex items-center gap-1 rounded-bl-xl bg-secondary px-3 py-1 text-xs font-medium text-white">
                    <Sparkles className="h-3 w-3" />
                    Популярный
                  </div>
                </div>
              )}

              {current && mode === "dashboard" && (
                <div className="absolute right-0 top-0">
                  <div className="flex items-center gap-1 rounded-bl-xl bg-primary px-3 py-1 text-xs font-medium text-white">
                    <Check className="h-3 w-3" />
                    Ваш тариф
                  </div>
                </div>
              )}

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

                <div className="mb-4">
                  {plan.isFree ? (
                    <p className="text-3xl font-bold text-success">0 ₽</p>
                  ) : plan.priceMonthly != null ? (
                    <div>
                      <p className="text-3xl font-bold text-foreground">
                        {plan.priceMonthly} ₽
                        <span className="text-base font-normal text-muted-foreground">/мес</span>
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
                      <>
                        Корзина: <strong>{plan.trashRetentionDays} дн.</strong>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Без корзины</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 border-t border-border px-6 py-4">
                {Object.entries(planFeatureLabels).map(([key]) => {
                  const enabled = isPlanFeatureEnabled(plan, key);
                  const tip = getPlanFeatureTooltipContent(plan, key, enabled);
                  return (
                    <Tooltip key={key} delayDuration={180}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "flex cursor-default gap-3 text-left text-sm leading-snug outline-none",
                            "items-center rounded-lg py-0.5 -mx-1 px-1 transition-colors hover:bg-muted/40",
                          )}
                        >
                          {enabled ? (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10">
                              <Check className="h-3 w-3 text-success" />
                            </div>
                          ) : (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface2">
                              <X className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span
                            className={cn(
                              "min-w-0 flex-1 font-medium",
                              enabled ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {planFeatureLabels[key]}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent
                          side="top"
                          sideOffset={10}
                          className={cn(
                            "z-[120] max-w-[min(280px,calc(100vw-2rem))] border-0 bg-transparent p-0 text-left text-foreground shadow-none",
                            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out",
                          )}
                        >
                          <div className="rounded-xl border border-emerald-400/70 bg-emerald-50 px-3.5 py-3 shadow-lg shadow-emerald-900/10 dark:border-emerald-500/75 dark:bg-emerald-950 dark:shadow-black/30">
                            <p className="text-[13px] font-semibold leading-tight tracking-tight text-emerald-950 dark:text-emerald-100">
                              {tip.title}
                            </p>
                            <div className="mt-1.5 space-y-1 text-[11px] leading-snug text-emerald-900/95 dark:text-emerald-100/90">
                              {tip.lines.map((line, i) => (
                                <p key={i}>{line}</p>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </TooltipPortal>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-border p-6 pt-4">
                {mode === "dashboard" && onSubscribe ? (
                  <>
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
                          onClick={() => onSubscribe(plan.id, "monthly")}
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
                            onClick={() => onSubscribe(plan.id, "yearly")}
                            disabled={subscribing === plan.id}
                          >
                            или {plan.priceYearly} ₽/год
                          </Button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ variant: isPopular ? "default" : "outline" }),
                      "inline-flex w-full items-center justify-center",
                    )}
                  >
                    {plan.isFree ? "Начать бесплатно" : "Зарегистрироваться"}
                  </Link>
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
