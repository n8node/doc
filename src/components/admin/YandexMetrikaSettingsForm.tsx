"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";

type YandexMetrikaResponse = {
  counterId: string | null;
  webvisor: boolean;
  clickmap: boolean;
  ecommerce: string | null;
  accurateTrackBounce: boolean;
  trackLinks: boolean;
};

export function YandexMetrikaSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counterId, setCounterId] = useState("");
  const [webvisor, setWebvisor] = useState(true);
  const [clickmap, setClickmap] = useState(true);
  const [ecommerce, setEcommerce] = useState("dataLayer");
  const [accurateTrackBounce, setAccurateTrackBounce] = useState(true);
  const [trackLinks, setTrackLinks] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/yandex-metrika");
      const data = (await res.json()) as YandexMetrikaResponse;
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "Не удалось загрузить настройки Яндекс.Метрики"
        );
      }
      setCounterId(data.counterId ?? "");
      setWebvisor(data.webvisor ?? true);
      setClickmap(data.clickmap ?? true);
      setEcommerce(data.ecommerce ?? "dataLayer");
      setAccurateTrackBounce(data.accurateTrackBounce ?? true);
      setTrackLinks(data.trackLinks ?? true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/yandex-metrika", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterId: counterId.trim() || null,
          webvisor,
          clickmap,
          ecommerce: ecommerce.trim() || "dataLayer",
          accurateTrackBounce,
          trackLinks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Настройки Яндекс.Метрики сохранены");
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
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Яндекс.Метрика</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Счётчик аналитики. Укажите ID счётчика — скрипт будет подключён на всех страницах. Оставьте пустым, чтобы отключить.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            ID счётчика
          </label>
          <Input
            value={counterId}
            onChange={(e) => setCounterId(e.target.value)}
            placeholder="107730757"
            className="max-w-md"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Числовой ID из интерфейса Яндекс.Метрики (Настройки → Код счётчика)
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Имя слоя данных (ecommerce)
          </label>
          <Input
            value={ecommerce}
            onChange={(e) => setEcommerce(e.target.value)}
            placeholder="dataLayer"
            className="max-w-md"
          />
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={webvisor}
              onChange={(e) => setWebvisor(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Вебвизор</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={clickmap}
              onChange={(e) => setClickmap(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Карта кликов</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={accurateTrackBounce}
              onChange={(e) => setAccurateTrackBounce(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Точный показатель отказов</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={trackLinks}
              onChange={(e) => setTrackLinks(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Отслеживание ссылок</span>
          </label>
        </div>
      </div>

      <div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
