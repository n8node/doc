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
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, cn } from "@/lib/utils";
import {
  formatTranscriptionAudioUsageLine,
  formatTranscriptionVideoUsageLine,
  getTranscriptionAudioDetailLines,
  getTranscriptionVideoDetailLines,
} from "@/lib/transcription-quota-display";
import {
  hasTranscriptionAudio,
  hasTranscriptionVideo,
} from "@/lib/plan-transcription-features";

interface PlanItem {
  id: string;
  name: string;
  isFree: boolean;
  isPopular: boolean;
  storageQuota: number;
  maxFileSize: number;
  features: Record<string, boolean>;
  aiAnalysisDocumentsQuota?: number | null;
  embeddingTokensQuota?: number | null;
  chatTokensQuota?: number | null;
  searchTokensQuota?: number | null;
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
  maxTranscriptionAudioMinutes?: number;
  maxTranscriptionVideoMinutes?: number;
  ragDocumentsQuota?: number | null;
  imageGenerationCreditsQuota?: number | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  trashRetentionDays: number;
}

/** Ответ GET /api/v1/plans/me — используем для бейджа и расхода транскрибации */
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

const featureLabels: Record<string, string> = {
  share_links: "Публичные ссылки",
  folder_share: "Шаринг папок",
  shared_access_email: "Совместный доступ",
  rag_memory: "RAG-память",
  n8n_connection: "Подключение к n8n",
  sheets: "Таблицы",
  ai_search: "AI-поиск по документам",
  document_chat: "AI чаты по документам",
  document_analysis: "AI-анализ документов",
  transcription_audio: "Транскрибация аудио",
  transcription_video: "Транскрибация видео",
  own_ai_keys: "Свой API-ключ (токены не списываются)",
  content_generation: "Генерация изображений",
};

function getFeatureTooltipContent(
  plan: PlanItem,
  key: string,
  enabled: boolean,
): { title: string; lines: string[] } {
  const label = featureLabels[key as keyof typeof featureLabels] ?? key;
  if (!enabled) {
    return {
      title: label,
      lines: ["Эта возможность не входит в выбранный тариф."],
    };
  }
  switch (key) {
    case "document_analysis":
      return {
        title: label,
        lines: [
          plan.aiAnalysisDocumentsQuota != null
            ? `Квота: ${plan.aiAnalysisDocumentsQuota} документов в месяц.`
            : "Безлимит по количеству документов для анализа в месяц.",
        ],
      };
    case "document_chat":
      return {
        title: label,
        lines: [
          plan.chatTokensQuota != null
            ? `Квота: ${plan.chatTokensQuota.toLocaleString("ru-RU")} токенов в месяц.`
            : "Безлимит токенов для чатов по документам.",
        ],
      };
    case "ai_search":
      return {
        title: label,
        lines: [
          plan.searchTokensQuota != null
            ? `Квота: ${plan.searchTokensQuota.toLocaleString("ru-RU")} токенов в месяц.`
            : "Безлимит токенов для AI-поиска по документам.",
        ],
      };
    case "transcription_audio":
      return {
        title: label,
        lines: getTranscriptionAudioDetailLines(plan),
      };
    case "transcription_video":
      return {
        title: label,
        lines: getTranscriptionVideoDetailLines(plan),
      };
    case "rag_memory":
      return {
        title: label,
        lines: [
          plan.ragDocumentsQuota != null
            ? `Квота: ${plan.ragDocumentsQuota} документов в RAG-коллекциях.`
            : "Безлимит документов в коллекциях памяти.",
        ],
      };
    case "content_generation":
      return {
        title: label,
        lines: [
          plan.imageGenerationCreditsQuota != null
            ? `Квота: ${plan.imageGenerationCreditsQuota.toLocaleString("ru-RU")} токенов в месяц на генерацию изображений.`
            : "Безлимит по токенам генерации в рамках тарифа.",
        ],
      };
    default:
      return {
        title: label,
        lines: ["Функция включена в этом тарифе."],
      };
  }
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
            className="mt-4 flex flex-col items-center gap-2"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Crown className="h-4 w-4" />
              Текущий тариф: {currentPlan.name}
            </div>
            {(() => {
              const audioU = formatTranscriptionAudioUsageLine(currentPlan);
              const videoU = formatTranscriptionVideoUsageLine(currentPlan);
              if (!audioU && !videoU) return null;
              return (
                <div className="max-w-xl space-y-1 text-center text-xs text-muted-foreground">
                  {audioU && <p>{audioU}</p>}
                  {videoU && <p>{videoU}</p>}
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* Plans grid */}
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

                {/* Features — только названия; квоты в подсказке при наведении */}
                <div className="flex-1 space-y-2 border-t border-border px-6 py-4">
                  {Object.entries(featureLabels).map(([key, label]) => {
                    const enabled =
                      key === "transcription_audio"
                        ? hasTranscriptionAudio(plan.features)
                        : key === "transcription_video"
                          ? hasTranscriptionVideo(plan.features)
                          : !!plan.features?.[key];
                    const tip = getFeatureTooltipContent(plan, key, enabled);
                    return (
                      <Tooltip key={key} delayDuration={180}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex cursor-default gap-3 text-sm leading-snug text-left outline-none",
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
                              {label}
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
