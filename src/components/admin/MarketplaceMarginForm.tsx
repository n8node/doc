"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Percent } from "lucide-react";

export function MarketplaceMarginForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marginPercent, setMarginPercent] = useState<number>(0);

  useEffect(() => {
    fetch("/api/v1/admin/marketplace-margin")
      .then((r) => r.json())
      .then((data) => {
        const v = data.marginPercent;
        setMarginPercent(typeof v === "number" ? Math.max(0, Math.min(95, v)) : 0);
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const val = Math.max(0, Math.min(95, Math.round(Number(marginPercent) || 0)));
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/marketplace-margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marginPercent: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      setMarginPercent(val);
      toast.success("Маржа сохранена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Маржа маркетплейса LLM
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Процент дохода платформы с каждого списания. Например: 50% — пользователь платит двойную цену, вы получаете половину.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Маржа (%)
          </label>
          <div className="mt-1 flex items-center gap-2 max-w-[200px]">
            <Input
              type="number"
              min={0}
              max={95}
              value={marginPercent}
              onChange={(e) => setMarginPercent(Math.max(0, Math.min(95, Number(e.target.value) || 0)))}
            />
            <span className="text-sm text-muted-foreground">0–95</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            При 0% маржа отключена. При 50% — пользователь платит 2× базовую стоимость.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
