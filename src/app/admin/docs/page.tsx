"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type DocPage = {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
};

export default function AdminDocsPage() {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<DocPage[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/docs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      setPages(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Удалить страницу «${title}»?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/admin/docs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      toast.success("Страница удалена");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Документация</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Редактирование страниц руководства пользователя. Доступно всем пользователям по адресу /docs
          </p>
        </div>
        <Link href="/admin/docs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Добавить страницу
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-muted-foreground">Страниц пока нет.</p>
          <Link href="/admin/docs/new" className="mt-4 inline-block">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Создать первую страницу
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <ul className="space-y-2">
            {pages.map((page) => (
              <li
                key={page.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-background"
              >
                <div>
                  <span className="font-medium text-foreground">{page.title}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">/{page.slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/docs/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Открыть
                  </a>
                  <Link href={`/admin/docs/${page.id}`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Редактировать
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(page.id, page.title)}
                    disabled={deletingId === page.id}
                  >
                    {deletingId === page.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
