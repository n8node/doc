"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Table2, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";

interface SheetItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  columnsCount: number;
  cellsCount: number;
}

export default function SheetsListPage() {
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/sheets");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Ошибка загрузки");
      }
      const data = await res.json();
      setSheets(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки таблиц");
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const handleCreate = async () => {
    const name = createName.trim() || "Новая таблица";
    setCreating(true);
    try {
      const res = await fetch("/api/v1/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Ошибка создания");
      }
      const data = await res.json();
      setCreateName("");
      toast.success("Таблица создана");
      window.location.href = `/dashboard/sheets/${data.id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/sheets/import", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Ошибка импорта");
      }
      const data = await res.json();
      toast.success(`Импортировано: ${data.rowsImported ?? 0} строк`);
      await loadSheets();
      window.location.href = `/dashboard/sheets/${data.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить таблицу «${name}»?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/sheets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      toast.success("Таблица удалена");
      await loadSheets();
    } catch {
      toast.error("Не удалось удалить таблицу");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Таблицы</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Название таблицы"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Создать
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="excel-import"
            onChange={handleImportExcel}
            disabled={importing}
          />
          <Button
            variant="outline"
            disabled={importing}
            className="gap-2"
            onClick={() => document.getElementById("excel-import")?.click()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Импорт Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Table2 className="h-5 w-5" />
            Мои таблицы
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sheets.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Нет таблиц. Создайте первую или импортируйте из Excel.
            </p>
          ) : (
            <ul className="space-y-2">
              {sheets.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <Link href={`/dashboard/sheets/${s.id}`} className="min-w-0 flex-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {s.columnsCount} кол., {s.cellsCount} ячеек
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(s.id, s.name)}
                    disabled={deletingId === s.id}
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
