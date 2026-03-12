"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TipTapEditor } from "@/components/admin/TipTapEditor";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

type PublicPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  sortOrder: number;
};

type PublicPageFormProps = {
  page: PublicPage | null;
  isNew?: boolean;
};

export function PublicPageForm({ page, isNew = false }: PublicPageFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [content, setContent] = useState(page?.content ?? "");

  useEffect(() => {
    setSlug(page?.slug ?? "");
    setTitle(page?.title ?? "");
    setContent(page?.content ?? "");
  }, [page?.id]);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Укажите название");
      return;
    }
    const finalSlug = slug.trim().toLowerCase().replace(/\s+/g, "-") || title.trim().toLowerCase().replace(/\s+/g, "-");

    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/v1/admin/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: finalSlug,
            title: title.trim(),
            content,
            sortOrder: 0,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Ошибка создания");
        toast.success("Страница создана");
        router.push(`/admin/pages/${data.id}`);
        router.refresh();
      } else if (page) {
        const res = await fetch(`/api/v1/admin/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: finalSlug,
            title: title.trim(),
            content,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
        toast.success("Сохранено");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <div>
          <label className="text-sm font-medium text-foreground">Slug (URL)</label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="about"
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Используется в URL: /pages/slug. Только латиница, цифры и дефисы.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Название</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="О нас"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Содержимое</label>
          <div className="mt-2">
            <TipTapEditor
              key={page?.id ?? "new"}
              content={content}
              onChange={setContent}
              placeholder="Введите текст страницы..."
              uploadUrl="/api/v1/admin/pages/upload"
            />
          </div>
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {isNew ? "Создать" : "Сохранить"}
      </Button>
    </div>
  );
}
