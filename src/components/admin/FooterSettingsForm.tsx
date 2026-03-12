"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import type { FooterConfig, FooterItem, SocialPlatform } from "@/lib/footer-config";

type PublicPage = { id: string; slug: string; title: string };

export function FooterSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FooterConfig>({
    columns: [{ title: "Навигация", items: [] }],
    social: [],
    copyright: "",
  });
  const [publicPages, setPublicPages] = useState<PublicPage[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [footerRes, pagesRes] = await Promise.all([
        fetch("/api/v1/admin/footer"),
        fetch("/api/v1/admin/pages"),
      ]);
      const footerData = (await footerRes.json()) as FooterConfig | { error?: string };
      const pagesData = (await pagesRes.json()) as PublicPage[] | { error?: string };
      if (!footerRes.ok) throw new Error((footerData as { error?: string }).error || "Не удалось загрузить футер");
      setConfig(footerData as FooterConfig);
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
      const res = await fetch("/api/v1/admin/footer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Футер сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const addColumn = () => {
    setConfig((c) => ({
      ...c,
      columns: [...c.columns, { title: "Новая колонка", items: [] }],
    }));
  };

  const removeColumn = (idx: number) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.filter((_, i) => i !== idx),
    }));
  };

  const updateColumnTitle = (idx: number, title: string) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) => (i === idx ? { ...col, title } : col)),
    }));
  };

  const addItem = (colIdx: number, item?: FooterItem) => {
    const newItem = item ?? { label: "", href: "" };
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) =>
        i === colIdx ? { ...col, items: [...col.items, newItem] } : col
      ),
    }));
  };

  const removeItem = (colIdx: number, itemIdx: number) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) =>
        i === colIdx ? { ...col, items: col.items.filter((_, j) => j !== itemIdx) } : col
      ),
    }));
  };

  const updateItem = (colIdx: number, itemIdx: number, field: "label" | "href", value: string) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) =>
        i === colIdx
          ? {
              ...col,
              items: col.items.map((it, j) =>
                j === itemIdx ? { ...it, [field]: value } : it
              ),
            }
          : col
      ),
    }));
  };

  const addPublicPage = (colIdx: number, page: PublicPage) => {
    addItem(colIdx, { label: page.title, href: `/pages/${page.slug}` });
  };

  const addSocial = (platform: SocialPlatform, url: string) => {
    if (!url.trim()) return;
    setConfig((c) => ({
      ...c,
      social: [...c.social.filter((s) => s.platform !== platform), { platform, url: url.trim() }],
    }));
  };

  const removeSocial = (platform: SocialPlatform) => {
    setConfig((c) => ({ ...c, social: c.social.filter((s) => s.platform !== platform) }));
  };

  const platformLabels: Record<SocialPlatform, string> = {
    telegram: "Telegram",
    vk: "VK",
    github: "GitHub",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Колонки и ссылки</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {config.columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="rounded-xl border border-border bg-surface2 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Input
                  value={col.title}
                  onChange={(e) => updateColumnTitle(colIdx, e.target.value)}
                  placeholder="Заголовок колонки"
                  className="font-medium"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeColumn(colIdx)}
                  disabled={config.columns.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-2">
                {col.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={item.label}
                      onChange={(e) => updateItem(colIdx, itemIdx, "label", e.target.value)}
                      placeholder="Подпись"
                      className="flex-1"
                    />
                    <Input
                      value={item.href}
                      onChange={(e) => updateItem(colIdx, itemIdx, "href", e.target.value)}
                      placeholder="/path"
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(colIdx, itemIdx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(colIdx)}
                  >
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
                        if (page) addPublicPage(colIdx, page);
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
          ))}
        </div>
        <Button variant="outline" onClick={addColumn}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить колонку
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Соцсети</h3>
        <div className="flex flex-wrap gap-4">
          {(["telegram", "vk", "github"] as const).map((platform) => {
            const cur = config.social.find((s) => s.platform === platform);
            return (
              <div key={platform} className="flex items-center gap-2 rounded-lg border border-border bg-surface2 px-4 py-2">
                <span className="text-sm font-medium">{platformLabels[platform]}</span>
                {cur ? (
                  <>
                    <span className="text-muted-foreground">{cur.url}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSocial(platform)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const url = (e.currentTarget.elements.namedItem("url") as HTMLInputElement)?.value;
                      if (url) addSocial(platform, url);
                    }}
                  >
                    <Input
                      name="url"
                      placeholder="https://..."
                      className="w-48"
                    />
                    <Button type="submit" size="sm">
                      Добавить
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Copyright</label>
        <Input
          value={config.copyright}
          onChange={(e) =>
            setConfig((c) => ({ ...c, copyright: e.target.value }))
          }
          placeholder="© 2026 QoQon — Облачное хранилище с AI"
        />
        <p className="text-xs text-muted-foreground">
          Поддерживается переменная {`{year}`} — будет заменена на текущий год.
        </p>
      </div>
    </div>
  );
}
