"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import type { HeaderNavConfig, HeaderNavItem } from "@/lib/header-nav-config";

type PublicPage = { id: string; slug: string; title: string };

export function HeaderNavSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<HeaderNavConfig>({ items: [] });
  const [publicPages, setPublicPages] = useState<PublicPage[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [navRes, pagesRes] = await Promise.all([
        fetch("/api/v1/admin/header-nav"),
        fetch("/api/v1/admin/pages"),
      ]);
      const navData = (await navRes.json()) as HeaderNavConfig | { error?: string };
      const pagesData = (await pagesRes.json()) as PublicPage[] | { error?: string };
      if (!navRes.ok) throw new Error((navData as { error?: string }).error || "Не удалось загрузить меню");
      setConfig(navData as HeaderNavConfig);
      setPublicPages(Array.isArray(pagesData) ? pagesData : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
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
      const res = await fetch("/api/v1/admin/header-nav", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Меню шапки сохранено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (item?: HeaderNavItem) => {
    const newItem = item ?? { label: "", href: "" };
    setConfig((c) => ({ ...c, items: [...c.items, newItem] }));
  };

  const removeItem = (idx: number) => {
    setConfig((c) => ({ ...c, items: c.items.filter((_, j) => j !== idx) }));
  };

  const updateItem = (idx: number, field: "label" | "href", value: string) => {
    setConfig((c) => ({
      ...c,
      items: c.items.map((it, j) => (j === idx ? { ...it, [field]: value } : it)),
    }));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= config.items.length) return;
    setConfig((c) => {
      const items = [...c.items];
      const t = items[index];
      items[index] = items[next];
      items[next] = t;
      return { ...c, items };
    });
  };

  const addPublicPage = (page: PublicPage) => {
    addItem({ label: page.title, href: `/pages/${page.slug}` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Пункты отображаются в шапке на всех страницах с логотипом. Ссылка «Админка» для роли ADMIN
        добавляется автоматически и в настройках не редактируется.
      </p>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Ссылки</h3>
        <div className="space-y-2 rounded-xl border border-border bg-surface2 p-4">
          {config.items.map((item, itemIdx) => (
            <div key={itemIdx} className="flex flex-wrap items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-8 shrink-0 text-xs text-muted-foreground">{itemIdx + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={itemIdx === 0}
                onClick={() => move(itemIdx, -1)}
              >
                Вверх
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={itemIdx === config.items.length - 1}
                onClick={() => move(itemIdx, 1)}
              >
                Вниз
              </Button>
              <Input
                value={item.label}
                onChange={(e) => updateItem(itemIdx, "label", e.target.value)}
                placeholder="Подпись"
                className="min-w-[140px] flex-1"
              />
              <Input
                value={item.href}
                onChange={(e) => updateItem(itemIdx, "href", e.target.value)}
                placeholder="/path или /#anchor"
                className="min-w-[180px] flex-1 font-mono text-sm"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(itemIdx)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addItem()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Ссылка
            </Button>
            {publicPages.length > 0 && (
              <select
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const slug = e.target.value;
                  if (!slug) return;
                  const page = publicPages.find((p) => p.slug === slug);
                  if (page) addPublicPage(page);
                  e.target.value = "";
                }}
              >
                <option value="">+ Публичная страница</option>
                {publicPages.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
