"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Trash2, Save, Plus, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import type { DashboardContent, DashboardCard } from "@/lib/dashboard-content";

const IMAGE_LABELS: Record<string, string> = {
  hero: "Фоновое изображение героя",
  card_files: "Карточка «Файлы»",
  card_search: "Карточка «Поиск»",
  card_chat: "Карточка «AI-чаты»",
  card_rag: "Карточка «RAG-память»",
  card_embeddings: "Карточка «Векторная база»",
  card_api: "Карточка «API»",
};

function getImageUrl(imageId: string): string {
  return `/api/public/dashboard-asset/${imageId}?v=${Date.now()}`;
}

export function DashboardContentForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [content, setContent] = useState<DashboardContent | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/dashboard-content");
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
      const res = await fetch("/api/v1/admin/dashboard-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroTitle: content.heroTitle,
          heroSubtitle: content.heroSubtitle,
          steps: content.steps,
          cards: content.cards,
          quickUploadLabel: content.quickUploadLabel,
          quickSearchLabel: content.quickSearchLabel,
          quickChatLabel: content.quickChatLabel,
        }),
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
      const res = await fetch("/api/v1/admin/dashboard-content/upload", {
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
      const input = fileInputRefs.current[imageId];
      if (input) input.value = "";
    }
  };

  const removeImage = async (imageId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/dashboard-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeImageIds: [imageId] }),
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

  const updateStep = (index: number, field: "title" | "description", value: string) => {
    if (!content) return;
    const steps = [...content.steps];
    steps[index] = { ...steps[index], [field]: value };
    setContent({ ...content, steps });
  };

  const updateCard = (index: number, field: keyof DashboardCard, value: string) => {
    if (!content) return;
    const cards = [...content.cards];
    cards[index] = { ...cards[index], [field]: value };
    setContent({ ...content, cards });
  };

  const addStep = () => {
    if (!content) return;
    setContent({
      ...content,
      steps: [...content.steps, { title: "Новый шаг", description: "" }],
    });
  };

  const removeStep = (index: number) => {
    if (!content || content.steps.length <= 1) return;
    const steps = content.steps.filter((_, i) => i !== index);
    setContent({ ...content, steps });
  };

  const addCard = () => {
    if (!content) return;
    const newCard: DashboardCard = {
      id: `custom_${Date.now()}`,
      title: "Новый инструмент",
      description: "",
      href: "/dashboard/files",
      cta: "Открыть",
      imageKey: null,
    };
    setContent({ ...content, cards: [...content.cards, newCard] });
  };

  const removeCard = (index: number) => {
    if (!content) return;
    const cards = content.cards.filter((_, i) => i !== index);
    setContent({ ...content, cards });
  };

  const moveCardUp = (index: number) => {
    if (!content || index <= 0) return;
    const cards = [...content.cards];
    [cards[index - 1], cards[index]] = [cards[index], cards[index - 1]];
    setContent({ ...content, cards });
  };

  const moveCardDown = (index: number) => {
    if (!content || index >= content.cards.length - 1) return;
    const cards = [...content.cards];
    [cards[index], cards[index + 1]] = [cards[index + 1], cards[index]];
    setContent({ ...content, cards });
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
        <h2 className="text-lg font-semibold text-foreground">Контент главной страницы дашборда</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Редактируйте тексты, изображения и карточки инструментов. Изменения отображаются при переходе на /dashboard.
        </p>
      </div>

      {/* Hero */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Блок героя (приветствие)</h3>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок</label>
          <Input
            value={content.heroTitle}
            onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
            placeholder="Добро пожаловать"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Подзаголовок</label>
          <Textarea
            value={content.heroSubtitle}
            onChange={(e) => setContent({ ...content, heroSubtitle: e.target.value })}
            placeholder="Облачное хранилище с AI-поиском"
            rows={2}
            className="mt-1"
          />
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
                ref={(el) => { fileInputRefs.current["hero"] = el; }}
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
                onClick={() => fileInputRefs.current["hero"]?.click()}
                disabled={uploadingId !== null}
              >
                {uploadingId === "hero" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Загрузить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void removeImage("hero")}
                disabled={saving || !content.heroImageKey}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Как это работает (шаги)</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить шаг
          </Button>
        </div>
        <div className="space-y-3">
          {content.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface2/30 p-3">
              <span className="text-muted-foreground">{i + 1}.</span>
              <div className="flex-1 space-y-2">
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(i, "title", e.target.value)}
                  placeholder="Название шага"
                  className="font-medium"
                />
                <Input
                  value={step.description}
                  onChange={(e) => updateStep(i, "description", e.target.value)}
                  placeholder="Описание"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeStep(i)}
                disabled={content.steps.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Карточки инструментов</h3>
          <Button type="button" variant="outline" size="sm" onClick={addCard}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить инструмент
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {content.cards.map((card, i) => (
            <div key={card.id} className="space-y-2 rounded-lg border border-border/70 bg-surface2/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">ID: {card.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveCardUp(i)}
                    disabled={i === 0}
                    title="Поднять"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveCardDown(i)}
                    disabled={i === content.cards.length - 1}
                    title="Опустить"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeCard(i)}
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input
                value={card.title}
                onChange={(e) => updateCard(i, "title", e.target.value)}
                placeholder="Заголовок"
              />
              <Textarea
                value={card.description}
                onChange={(e) => updateCard(i, "description", e.target.value)}
                placeholder="Описание"
                rows={2}
              />
              <Input
                value={card.href}
                onChange={(e) => updateCard(i, "href", e.target.value)}
                placeholder="/dashboard/files"
              />
              <Input
                value={card.cta}
                onChange={(e) => updateCard(i, "cta", e.target.value)}
                placeholder="Текст кнопки"
              />
              {card.imageKey && IMAGE_LABELS[card.imageKey] && (
                <div>
                  <label className="text-xs text-muted-foreground">{IMAGE_LABELS[card.imageKey]}</label>
                  <div className="mt-1 flex items-center gap-2">
                    <img
                      src={getImageUrl(card.imageKey)}
                      alt=""
                      className="h-12 w-12 rounded border border-border object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="flex gap-1">
                      <input
                        ref={(el) => { fileInputRefs.current[card.imageKey!] = el; }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadImage(card.imageKey!, file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[card.imageKey!]?.click()}
                        disabled={uploadingId !== null}
                      >
                        {uploadingId === card.imageKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeImage(card.imageKey!)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions labels */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Подписи быстрых действий</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Кнопка загрузки</label>
            <Input
              value={content.quickUploadLabel}
              onChange={(e) => setContent({ ...content, quickUploadLabel: e.target.value })}
              placeholder="Загрузить"
              className="mt-1 max-w-[180px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Кнопка поиска</label>
            <Input
              value={content.quickSearchLabel}
              onChange={(e) => setContent({ ...content, quickSearchLabel: e.target.value })}
              placeholder="Поиск"
              className="mt-1 max-w-[180px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Кнопка чата</label>
            <Input
              value={content.quickChatLabel}
              onChange={(e) => setContent({ ...content, quickChatLabel: e.target.value })}
              placeholder="Новый чат"
              className="mt-1 max-w-[180px]"
            />
          </div>
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Сохранить
      </Button>
    </div>
  );
}
