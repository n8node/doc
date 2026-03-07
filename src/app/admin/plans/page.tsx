"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Reorder, useDragControls } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  HardDrive,
  FileUp,
  Loader2,
  Crown,
  Gift,
  GripVertical,
  Sparkles,
  BrainCircuit,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanDialog } from "@/components/admin/PlanDialog";
import { formatBytes } from "@/lib/utils";

interface PlanItem {
  id: string;
  name: string;
  isFree: boolean;
  isPopular: boolean;
  sortOrder: number;
  storageQuota: number;
  maxFileSize: number;
  trashRetentionDays: number;
  embeddingTokensQuota: number | null;
  aiAnalysisDocumentsQuota?: number | null;
  features: Record<string, boolean>;
  priceMonthly: number | null;
  priceYearly: number | null;
  usersCount: number;
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
  dragControls,
}: {
  plan: PlanItem;
  onEdit: () => void;
  onDelete: () => void;
  dragControls: ReturnType<typeof useDragControls>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 flex h-full items-center pl-1.5">
        <button
          className="cursor-grab touch-none rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="pl-8">
        {/* Badges */}
        <div className="absolute right-4 top-4 flex gap-2">
          {plan.isPopular && (
            <Badge className="bg-secondary text-white">
              <Sparkles className="mr-1 h-3 w-3" />
              Популярный
            </Badge>
          )}
          {plan.isFree && (
            <Badge variant="success">
              <Gift className="mr-1 h-3 w-3" />
              Бесплатный
            </Badge>
          )}
        </div>

        <CardHeader className="pb-3">
          <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>

          {plan.isFree ? (
            <p className="text-2xl font-bold text-success">Бесплатно</p>
          ) : (
            <div>
              {plan.priceMonthly != null && (
                <p className="text-2xl font-bold text-foreground">
                  {plan.priceMonthly} ₽
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    /мес
                  </span>
                </p>
              )}
              {plan.priceYearly != null && (
                <p className="text-sm text-muted-foreground">
                  или {plan.priceYearly} ₽/год
                </p>
              )}
              {!plan.priceMonthly && !plan.priceYearly && (
                <p className="text-sm text-warning">Цена не указана</p>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span>Хранилище: {formatBytes(plan.storageQuota)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <span>Макс. файл: {formatBytes(plan.maxFileSize)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BrainCircuit className="h-4 w-4 text-muted-foreground" />
              <span>
                Токенов на анализ:{" "}
                {plan.embeddingTokensQuota != null
                  ? `${plan.embeddingTokensQuota.toLocaleString()}/мес`
                  : "без лимита"}
              </span>
            </div>
            {plan.features?.document_analysis && (
              <div className="flex items-center gap-2 text-sm">
                <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                <span>
                  AI-анализ док.:{" "}
                  {plan.aiAnalysisDocumentsQuota != null
                    ? `${plan.aiAnalysisDocumentsQuota}/мес`
                    : "безлимит"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Пользователей: {plan.usersCount}</span>
            </div>
          </div>

          {plan.features && Object.keys(plan.features).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(plan.features).map(([key, enabled]) => (
                <span
                  key={key}
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    enabled
                      ? "bg-success/10 text-success"
                      : "bg-surface2 text-muted-foreground line-through"
                  }`}
                >
                  {key.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-border pt-4">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-error hover:bg-error/10 hover:text-error"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function ReorderablePlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: PlanItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={plan}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
    >
      <PlanCard
        plan={plan}
        onEdit={onEdit}
        onDelete={onDelete}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plans");
      const data = await res.json();
      if (res.ok) setPlans(data.plans ?? []);
    } catch {
      toast.error("Ошибка загрузки тарифов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleReorder = async (newOrder: PlanItem[]) => {
    setPlans(newOrder);

    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/plans/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newOrder.map((p) => p.id) }),
      });
      if (!res.ok) toast.error("Ошибка сохранения порядка");
    } catch {
      toast.error("Ошибка сохранения порядка");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: PlanItem) => {
    if (plan.usersCount > 0) {
      toast.error(
        `Нельзя удалить: ${plan.usersCount} пользователей на этом тарифе`
      );
      return;
    }
    if (!confirm(`Удалить тариф "${plan.name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/admin/plans/${plan.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Тариф удалён");
        loadPlans();
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const openEdit = (plan: PlanItem) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Тарифные планы
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление тарифами и подписками. Перетащите для изменения порядка.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Сохранение...
            </span>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Создать тариф
          </Button>
        </div>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center">
          <Crown className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Тарифов пока нет</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Создайте первый тариф для ваших пользователей
          </p>
          <Button onClick={openCreate} className="mt-6 gap-2">
            <Plus className="h-4 w-4" />
            Создать тариф
          </Button>
        </Card>
      ) : (
        <Reorder.Group
          axis="y"
          values={plans}
          onReorder={handleReorder}
          className="space-y-4"
        >
          {plans.map((plan) => (
            <ReorderablePlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => openEdit(plan)}
              onDelete={() => handleDelete(plan)}
            />
          ))}
        </Reorder.Group>
      )}

      {/* Dialog */}
      <PlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={loadPlans}
        plan={editingPlan}
      />
    </div>
  );
}
