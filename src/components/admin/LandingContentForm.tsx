"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Trash2, Save, Plus } from "lucide-react";
import type { LandingContent } from "@/lib/landing-content";

function getImageUrl(imageId: string): string {
  return `/api/public/landing-asset/${imageId}?v=${Date.now()}`;
}

export function LandingContentForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [content, setContent] = useState<LandingContent | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/landing-content");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
      setContent(data);
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

  const uploadImage = async (imageId: string, file: File) => {
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
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = async () => {
    if (!content?.heroImageKey) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/landing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeImageIds: ["hero"] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      toast.success("Изображение удалено");
      await load();
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

  const updateFileCard = (index: number, field: "title" | "size" | "color", value: string) => {
    if (!content) return;
    const fileCards = [...content.fileCards];
    fileCards[index] = { ...fileCards[index], [field]: value };
    setContent({ ...content, fileCards });
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

  const addFileCard = () => {
    if (!content) return;
    setContent({
      ...content,
      fileCards: [...content.fileCards, { title: "Файл.pdf", size: "1 MB", color: "default" }],
    });
  };

  const removeFileCard = (index: number) => {
    if (!content || content.fileCards.length <= 1) return;
    const fileCards = content.fileCards.filter((_, i) => i !== index);
    setContent({ ...content, fileCards });
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
          Редактируйте тексты, изображения и блоки лендинга. Изменения отображаются на главной /.
        </p>
      </div>

      {/* Hero */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Блок героя</h3>
        <div>
          <label className="text-sm text-muted-foreground">Тэглайн (над заголовком)</label>
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
            placeholder="Облачное хранилище + API‑маркетплейс для RAG, поиска и чатов по документам"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Описание</label>
          <Textarea
            value={content.heroDescription}
            onChange={(e) => setContent({ ...content, heroDescription: e.target.value })}
            placeholder="Храните файлы, находите нужное..."
            rows={3}
            className="mt-1"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 1 (текст)</label>
            <Input
              value={content.ctaPrimary}
              onChange={(e) => setContent({ ...content, ctaPrimary: e.target.value })}
              placeholder="Начать бесплатно"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 1 (ссылка)</label>
            <Input
              value={content.ctaPrimaryHref}
              onChange={(e) => setContent({ ...content, ctaPrimaryHref: e.target.value })}
              placeholder="/login"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 2 (текст)</label>
            <Input
              value={content.ctaSecondary}
              onChange={(e) => setContent({ ...content, ctaSecondary: e.target.value })}
              placeholder="Смотреть демо"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Кнопка 2 (ссылка)</label>
            <Input
              value={content.ctaSecondaryHref}
              onChange={(e) => setContent({ ...content, ctaSecondaryHref: e.target.value })}
              placeholder="/docs"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Изображение героя (опционально)</label>
          <div className="mt-2 flex items-center gap-4">
            {content.heroImageKey ? (
              <img
                src={getImageUrl("hero")}
                alt="hero"
                className="h-24 w-auto rounded-lg border border-border object-contain"
              />
            ) : (
              <div className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-surface2/50 text-sm text-muted-foreground">
                Нет изображения
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("hero", file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingId !== null}
              >
                {uploadingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Загрузить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void removeImage()}
                disabled={saving || !content.heroImageKey}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            </div>
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

      {/* File cards */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Карточки примеров файлов</h3>
          <Button type="button" variant="outline" size="sm" onClick={addFileCard}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </div>
        <div className="space-y-3">
          {content.fileCards.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
              <Input
                value={c.title}
                onChange={(e) => updateFileCard(i, "title", e.target.value)}
                placeholder="Название файла"
                className="min-w-[180px]"
              />
              <Input
                value={c.size}
                onChange={(e) => updateFileCard(i, "size", e.target.value)}
                placeholder="Размер"
                className="w-24"
              />
              <select
                value={c.color ?? "default"}
                onChange={(e) => updateFileCard(i, "color", e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
              >
                <option value="red">Красный</option>
                <option value="blue">Синий</option>
                <option value="green">Зелёный</option>
                <option value="default">Акцент</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFileCard(i)}
                disabled={content.fileCards.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Сохранить
      </Button>
    </div>
  );
}
