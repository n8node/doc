"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TipTapEditor } from "@/components/admin/TipTapEditor";
import { Loader2, Save, RotateCcw } from "lucide-react";

type Content = {
  title: string;
  subtitle: string;
  httpTabHtml: string;
  pgvectorTabHtml: string;
};

export function N8nGuideContentForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [activeTab, setActiveTab] = useState<"http" | "pgvector">("pgvector");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/n8n-guide-content");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
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
      const res = await fetch("/api/v1/admin/n8n-guide-content", {
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

  const resetToDefaults = async () => {
    if (!window.confirm("Сбросить контент к значениям по умолчанию? Это перезапишет текущий контент.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/n8n-guide-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          subtitle: "",
          httpTabHtml: "",
          pgvectorTabHtml: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сброса");
      toast.success("Сброшено к умолчаниям");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сброса");
    } finally {
      setSaving(false);
    }
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
        <p className="text-sm text-muted-foreground">
          Редактируйте тексты и содержимое вкладок инструкции. Изменения отображаются на странице{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/dashboard/n8n-guide</code>.
        </p>
      </div>

      {/* Title + subtitle */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Заголовок и подзаголовок</h3>
        <div>
          <label className="text-sm text-muted-foreground">Заголовок</label>
          <Input
            value={content.title}
            onChange={(e) => setContent({ ...content, title: e.target.value })}
            placeholder="Интеграция Qoqon RAG с n8n"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Подзаголовок</label>
          <Input
            value={content.subtitle}
            onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            placeholder="Использование векторной базы Qoqon..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Tab editors */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Содержимое вкладок</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pgvector")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "pgvector"
                ? "bg-primary text-primary-foreground"
                : "bg-surface2/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Postgres PGVector Store
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("http")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "http"
                ? "bg-primary text-primary-foreground"
                : "bg-surface2/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            HTTP Request
          </button>
        </div>

        {activeTab === "http" && (
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">
              Контент вкладки «HTTP Request»
            </label>
            <TipTapEditor
              content={content.httpTabHtml}
              onChange={(html) => setContent({ ...content, httpTabHtml: html })}
              placeholder="Введите содержимое вкладки HTTP Request..."
            />
          </div>
        )}

        {activeTab === "pgvector" && (
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">
              Контент вкладки «Postgres PGVector Store»
            </label>
            <TipTapEditor
              content={content.pgvectorTabHtml}
              onChange={(html) => setContent({ ...content, pgvectorTabHtml: html })}
              placeholder="Введите содержимое вкладки PGVector Store..."
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
        <Button variant="outline" onClick={() => void resetToDefaults()} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Сбросить к умолчаниям
        </Button>
      </div>
    </div>
  );
}
