"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { YookassaSettingsForm } from "@/components/admin/YookassaSettingsForm";
import { RobokassaSettingsForm } from "@/components/admin/RobokassaSettingsForm";

type Provider = "yookassa" | "robokassa";

export function PaymentsSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<Provider>("yookassa");
  const [yookassaReady, setYookassaReady] = useState(false);
  const [robokassaReady, setRobokassaReady] = useState(false);

  useEffect(() => {
    fetch("/api/v1/admin/payment-provider")
      .then((r) => r.json())
      .then((data) => {
        if (data.activeProvider === "robokassa" || data.activeProvider === "yookassa") {
          setActive(data.activeProvider);
        }
        setYookassaReady(!!data.yookassaReady);
        setRobokassaReady(!!data.robokassaReady);
      })
      .catch(() => toast.error("Не удалось загрузить провайдер платежей"))
      .finally(() => setLoading(false));
  }, []);

  const saveProvider = async (next: Provider) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/payment-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setActive(next);
      toast.success(
        next === "yookassa"
          ? "Активна ЮKassa — новые платежи пойдут через ЮKassa"
          : "Активна Robokassa — новые платежи пойдут через Robokassa"
      );
      const refresh = await fetch("/api/v1/admin/payment-provider").then((r) => r.json());
      setYookassaReady(!!refresh.yookassaReady);
      setRobokassaReady(!!refresh.robokassaReady);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-border bg-surface2/40 p-5">
        <h2 className="text-lg font-semibold text-foreground">Активный провайдер платежей</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Тарифы и пополнение LLM-кошелька используют выбранную систему. Настройки обоих провайдеров
          можно хранить одновременно и переключаться при необходимости.
        </p>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant={active === "yookassa" ? "default" : "outline"}
              disabled={saving}
              onClick={() => void saveProvider("yookassa")}
              className="justify-start"
            >
              ЮKassa
              {!yookassaReady && (
                <span className="ml-2 text-xs opacity-80">(не настроена)</span>
              )}
            </Button>
            <Button
              type="button"
              variant={active === "robokassa" ? "default" : "outline"}
              disabled={saving}
              onClick={() => void saveProvider("robokassa")}
              className="justify-start"
            >
              Robokassa
              {!robokassaReady && (
                <span className="ml-2 text-xs opacity-80">(не настроена)</span>
              )}
            </Button>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>

      <hr className="border-border" />

      <YookassaSettingsForm />

      <hr className="border-border" />

      <RobokassaSettingsForm />
    </div>
  );
}
