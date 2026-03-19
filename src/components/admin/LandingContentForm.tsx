"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Trash2, Save, Plus } from "lucide-react";
import type { LandingContent, LandingFeature } from "@/lib/landing-content";

function normalizeLandingContent(data: unknown): LandingContent {
  const c = data as Record<string, unknown>;
  const df = c?.documentFormats as { title?: string; iconKeys?: unknown[] } | undefined;
  const iconKeys = Array.isArray(df?.iconKeys)
    ? Array.from({ length: 7 }, (_, i) => {
        const k = df.iconKeys[i];
        return typeof k === "string" && /^doc_format_[0-6]$/.test(k) ? k : "";
      })
    : ["", "", "", "", "", "", ""];
  return {
    ...(c as LandingContent),
    documentFormats: {
      title: typeof df?.title === "string" ? df.title : "Форматы документов",
      iconKeys,
    },
  };
}

function getImageUrl(imageId: string): string {
  return `/api/public/landing-asset/${imageId}?v=${Date.now()}`;
}

export function LandingContentForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [content, setContent] = useState<LandingContent | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/landing-content");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
      setContent(normalizeLandingContent(data));
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
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/landing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Контент сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (imageId: string, file: File, opts?: { skipReload?: boolean }) => {
    setUploadingId(imageId);
    try {
      const fd = new FormData();
      fd.set("imageId", imageId);
      fd.set("file", file);
      const res = await fetch("/api/v1/admin/landing-content/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      toast.success("Изображение загружено");
      if (!opts?.skipReload) await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingId(null);
      const input = fileInputRefs.current[imageId];
      if (input) input.value = "";
    }
  };

  const removeImage = async (imageId: string, opts?: { skipReload?: boolean }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/landing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeImageIds: [imageId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      toast.success("Изображение удалено");
      if (!opts?.skipReload) await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  const updateBenefit = (index: number, field: "text" | "color", value: string) => {
    if (!content) return;
    const benefits = [...content.benefits];
    benefits[index] = { ...benefits[index], [field]: value };
    setContent({ ...content, benefits });
  };

  const updateDocumentFormats = (field: "title", value: string) => {
    if (!content) return;
    setContent({
      ...content,
      documentFormats: { ...content.documentFormats, [field]: value },
    });
  };

  const updateFormatIcon = (index: number, iconKey: string) => {
    if (!content) return;
    const iconKeys = [...content.documentFormats.iconKeys];
    iconKeys[index] = iconKey;
    setContent({
      ...content,
      documentFormats: { ...content.documentFormats, iconKeys },
    });
  };

  const updateFeature = (index: number, field: keyof LandingFeature, value: string) => {
    if (!content) return;
    const features = [...content.features];
    features[index] = { ...features[index], [field]: value };
    setContent({ ...content, features });
  };

  const updateStep = (index: number, field: "title" | "desc" | "num" | "iconKey", value: string | number) => {
    if (!content) return;
    const steps = [...content.steps];
    steps[index] = { ...steps[index], [field]: field === "num" ? Number(value) : value };
    setContent({ ...content, steps });
  };

  const addBenefit = () => {
    if (!content) return;
    setContent({
      ...content,
      benefits: [...content.benefits, { text: "Новое преимущество", color: "default" }],
    });
  };

  const removeBenefit = (index: number) => {
    if (!content || content.benefits.length <= 1) return;
    const benefits = content.benefits.filter((_, i) => i !== index);
    setContent({ ...content, benefits });
  };

  const addFeature = () => {
    if (!content) return;
    const id = `f${Date.now()}`;
    setContent({
      ...content,
      features: [...content.features, { id, title: "Новая возможность", description: "", href: "/dashboard" }],
    });
  };

  const removeFeature = (index: number) => {
    if (!content || content.features.length <= 1) return;
    const features = content.features.filter((_, i) => i !== index);
    setContent({ ...content, features });
  };

  const addStep = () => {
    if (!content) return;
    const num = content.steps.length + 1;
    setContent({
      ...content,
      steps: [...content.steps, { num, title: "Новый шаг", desc: "" }],
    });
  };

  const removeStep = (index: number) => {
    if (!content || content.steps.length <= 1) return;
    const steps = content.steps.filter((_, i) => i !== index);
    setContent({ ...content, steps });
  };

  if (loading || !content) {
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
        <h2 className="text-lg font-semibold text-foreground">Контент главной страницы</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Кнопки показываются только если заполнены и текст, и ссылка. Пустое поле «Выделение» — без подсветки.
        </p>
      </div>

      {/* Hero */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Блок героя (центрированный)</h3>
        <div>
          <label className="text-sm text-muted-foreground">Тэглайн</label>
          <Input
            value={content.tagline}
            onChange={(e) => setContent({ ...content, tagline: e.target.value })}
            placeholder="Облачное хранилище нового поколения"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок</label>
          <Input
            value={content.heroTitle}
            onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
            placeholder="Облачное хранилище + API‑маркетплейс для RAG..."
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Слово/фраза для выделения акцентным цветом (оставьте пустым, чтобы не выделять)</label>
          <Input
            value={content.heroTitleHighlight}
            onChange={(e) => setContent({ ...content, heroTitleHighlight: e.target.value })}
            placeholder="API‑маркетплейс"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Описание</label>
          <Textarea
            value={content.heroDescription}
            onChange={(e) => setContent({ ...content, heroDescription: e.target.value })}
            placeholder="Храните файлы..."
            rows={3}
            className="mt-1"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 1 — текст (пусто = скрыть)</label>
            <Input
              value={content.ctaPrimary}
              onChange={(e) => setContent({ ...content, ctaPrimary: e.target.value })}
              placeholder="Начать бесплатно"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 1 — ссылка</label>
            <Input
              value={content.ctaPrimaryHref}
              onChange={(e) => setContent({ ...content, ctaPrimaryHref: e.target.value })}
              placeholder="/login"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 2 — текст (пусто = скрыть)</label>
            <Input
              value={content.ctaSecondary}
              onChange={(e) => setContent({ ...content, ctaSecondary: e.target.value })}
              placeholder="Смотреть демо"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 2 — ссылка</label>
            <Input
              value={content.ctaSecondaryHref}
              onChange={(e) => setContent({ ...content, ctaSecondaryHref: e.target.value })}
              placeholder="/docs"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Преимущества (точки под CTA)</h3>
          <Button type="button" variant="outline" size="sm" onClick={addBenefit}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </div>
        <div className="space-y-3">
          {content.benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
              <Input
                value={b.text}
                onChange={(e) => updateBenefit(i, "text", e.target.value)}
                placeholder="Текст преимущества"
                className="flex-1"
              />
              <select
                value={b.color ?? "default"}
                onChange={(e) => updateBenefit(i, "color", e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
              >
                <option value="green">Зелёный</option>
                <option value="blue">Синий</option>
                <option value="purple">Фиолетовый</option>
                <option value="default">Акцент</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeBenefit(i)}
                disabled={content.benefits.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Форматы документов */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Блок «Форматы документов»</h3>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок</label>
          <Input
            value={content.documentFormats.title}
            onChange={(e) => updateDocumentFormats("title", e.target.value)}
            placeholder="Форматы документов"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Иконки (до 7 шт., PNG/JPEG/WebP/SVG)</label>
          <div className="mt-2 flex flex-wrap gap-4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const iconId = `doc_format_${i}`;
              const hasIcon = content.documentFormats.iconKeys[i] === iconId;
              return (
                <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
                  <span className="text-xs text-muted-foreground">Иконка {i + 1}</span>
                  {hasIcon && (
                    <img src={getImageUrl(iconId)} alt="" className="h-12 w-12 rounded border object-contain" />
                  )}
                  <div className="flex gap-1">
                    <input
                      ref={(el) => { fileInputRefs.current[iconId] = el; }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadImage(iconId, file, { skipReload: true }).then(() => {
                            updateFormatIcon(i, iconId);
                          });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[iconId]?.click()}
                      disabled={uploadingId !== null}
                    >
                      {uploadingId === iconId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                    {hasIcon && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          updateFormatIcon(i, "");
                          void removeImage(iconId, { skipReload: true });
                        }}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Раздел «Возможности»</h3>
          <Button type="button" variant="outline" size="sm" onClick={addFeature}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок раздела</label>
          <Input
            value={content.featuresTitle}
            onChange={(e) => setContent({ ...content, featuresTitle: e.target.value })}
            placeholder="Возможности"
            className="mt-1"
          />
        </div>
        <div className="space-y-3">
          {content.features.map((f, i) => {
            const iconId = `feature_${i}`;
            return (
              <div key={f.id} className="space-y-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Иконка PNG:</span>
                  <input
                    ref={(el) => { fileInputRefs.current[iconId] = el; }}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadImage(iconId, file, { skipReload: true }).then(() => {
                          updateFeature(i, "iconKey", iconId);
                        });
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRefs.current[iconId]?.click()}
                    disabled={uploadingId !== null}
                  >
                    {uploadingId === iconId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  {f.iconKey && (
                    <>
                      <img src={getImageUrl(iconId)} alt="" className="h-8 w-8 rounded object-contain" />
                      <Button variant="ghost" size="sm" onClick={() => { updateFeature(i, "iconKey", ""); void removeImage(iconId, { skipReload: true }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <Input
                  value={f.title}
                  onChange={(e) => updateFeature(i, "title", e.target.value)}
                  placeholder="Заголовок"
                />
                <Textarea
                  value={f.description}
                  onChange={(e) => updateFeature(i, "description", e.target.value)}
                  placeholder="Описание"
                  rows={2}
                />
                <Input
                  value={f.href}
                  onChange={(e) => updateFeature(i, "href", e.target.value)}
                  placeholder="/dashboard/files"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFeature(i)}
                  disabled={content.features.length <= 1}
                >
                  Удалить
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Раздел «Как это работает»</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок раздела</label>
          <Input
            value={content.stepsTitle}
            onChange={(e) => setContent({ ...content, stepsTitle: e.target.value })}
            placeholder="Как это работает"
            className="mt-1"
          />
        </div>
        <div className="space-y-3">
          {content.steps.map((s, i) => {
            const iconId = `step_${i}`;
            return (
              <div key={i} className="space-y-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">№</label>
                  <Input
                    type="number"
                    value={s.num}
                    onChange={(e) => updateStep(i, "num", e.target.value)}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">Иконка PNG:</span>
                  <input
                    ref={(el) => { fileInputRefs.current[iconId] = el; }}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadImage(iconId, file, { skipReload: true }).then(() => {
                          updateStep(i, "iconKey", iconId);
                        });
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRefs.current[iconId]?.click()}
                    disabled={uploadingId !== null}
                  >
                    {uploadingId === iconId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  {s.iconKey && (
                    <>
                      <img src={getImageUrl(iconId)} alt="" className="h-8 w-8 rounded object-contain" />
                      <Button variant="ghost" size="sm" onClick={() => { updateStep(i, "iconKey", ""); void removeImage(iconId, { skipReload: true }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <Input
                  value={s.title}
                  onChange={(e) => updateStep(i, "title", e.target.value)}
                  placeholder="Заголовок шага"
                />
                <Input
                  value={s.desc}
                  onChange={(e) => updateStep(i, "desc", e.target.value)}
                  placeholder="Описание"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(i)}
                  disabled={content.steps.length <= 1}
                >
                  Удалить
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Сохранить
      </Button>
    </div>
  );
}
