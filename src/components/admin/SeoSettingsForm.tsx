"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";

type SeoResponse = {
  title: string | null;
  description: string | null;
  keywords: string | null;
};

export function SeoSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/seo");
      const data = (await res.json()) as SeoResponse;
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось загрузить настройки SEO");
      }
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setKeywords(data.keywords ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить SEO");
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
      const res = await fetch("/api/v1/admin/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, keywords }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("SEO настройки сохранены");
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
        <h2 className="text-lg font-semibold text-foreground">SEO</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Настройки title, description и keywords для поисковых систем.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название сайта — Облачное хранилище с AI"
            className="max-w-xl"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Отображается во вкладке браузера и в результатах поиска
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dropbox-подобный сервис для РФ с поиском по документам"
            className="max-w-xl w-full min-h-[80px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Краткое описание сайта для поисковых систем
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Keywords</label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="облачное хранилище, документы, AI, поиск"
            className="max-w-xl w-full min-h-[60px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={2}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ключевые слова через запятую
          </p>
        </div>
      </div>

      <div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
