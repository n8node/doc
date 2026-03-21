"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  title: string;
  dateLabel: string;
  sortOrder: number;
  completed: boolean;
};

export function RoadmapAdminForm() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/v1/admin/roadmap");
    if (!res.ok) {
      setError("Не удалось загрузить этапы");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSteps(data.steps ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function savePatch(id: string, patch: Partial<Pick<Step, "title" | "dateLabel" | "completed">>) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/v1/admin/roadmap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Ошибка сохранения");
      return;
    }
    const updated = await res.json();
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
  }

  async function reorder(orderedIds: string[]) {
    setError(null);
    const res = await fetch("/api/v1/admin/roadmap/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      setError("Не удалось изменить порядок");
      return;
    }
    const data = await res.json();
    setSteps(data.steps ?? []);
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= steps.length) return;
    const ids = steps.map((s) => s.id);
    const t = ids[index];
    ids[index] = ids[next];
    ids[next] = t;
    void reorder(ids);
  }

  async function remove(id: string) {
    if (!confirm("Удалить этот этап?")) return;
    setError(null);
    const res = await fetch(`/api/v1/admin/roadmap/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Не удалось удалить");
      return;
    }
    const data = await res.json().catch(() => null);
    if (data?.steps) setSteps(data.steps);
    else void load();
  }

  async function add() {
    const title = newTitle.trim();
    const dateLabel = newDate.trim();
    if (!title || !dateLabel) {
      setError("Укажите название и дату/период");
      return;
    }
    setError(null);
    const res = await fetch("/api/v1/admin/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dateLabel, completed: false }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Ошибка");
      return;
    }
    setNewTitle("");
    setNewDate("");
    await load();
  }

  if (loading) {
    return <p className="text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Новый этап</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-title">Название</Label>
            <Input
              id="new-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например: Тестирование"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-date">Дата / период</Label>
            <Input
              id="new-date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              placeholder="Например: Ноябрь 2024"
            />
          </div>
        </div>
        <Button type="button" onClick={() => void add()}>
          Добавить
        </Button>
      </div>

      <ul className="space-y-4">
        {steps.map((s, index) => (
          <li
            key={s.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Вверх
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              >
                Вниз
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => void remove(s.id)}
              >
                Удалить
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`title-${s.id}`}>Название</Label>
                <Input
                  id={`title-${s.id}`}
                  defaultValue={s.title}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.title) void savePatch(s.id, { title: v });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`date-${s.id}`}>Дата / период</Label>
                <Input
                  id={`date-${s.id}`}
                  defaultValue={s.dateLabel}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.dateLabel) void savePatch(s.id, { dateLabel: v });
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                id={`done-${s.id}`}
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                checked={s.completed}
                disabled={savingId === s.id}
                onChange={(e) => void savePatch(s.id, { completed: e.target.checked })}
              />
              <Label htmlFor={`done-${s.id}`} className={cn("cursor-pointer", savingId === s.id && "opacity-60")}>
                Этап выполнен
              </Label>
            </div>
          </li>
        ))}
      </ul>

      {steps.length === 0 && (
        <p className="text-sm text-muted-foreground">Этапов пока нет — добавьте первый блок выше.</p>
      )}
    </div>
  );
}
