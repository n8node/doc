"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Plus, Download } from "lucide-react";
import { toast } from "sonner";

interface ColumnInfo {
  id: string;
  order: number;
  name: string;
  dataType: string;
  config: unknown;
}

interface SheetData {
  id: string;
  name: string;
  columns: ColumnInfo[];
  rows: Array<{ rowIndex: number; cells: Record<string, string | null> }>;
}

interface RowRecord {
  rowIndex: number;
  [key: string]: string | null | number;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- generic required for declaration merge
  interface TableMeta<TData extends RowData> {
    updateCell?: (rowIndex: number, columnId: string, value: string | null) => void;
    sheetId?: string;
  }
}

export default function SheetDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameEditing, setNameEditing] = useState(false);

  const loadSheet = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/sheets/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Таблица не найдена");
          return;
        }
        throw new Error("Ошибка загрузки");
      }
      const data = await res.json();
      setSheet(data);
      setEditName(data.name ?? "");
    } catch {
      setError("Не удалось загрузить таблицу");
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const saveCell = useCallback(
    async (rowIndex: number, columnId: string, value: string | null) => {
      if (!id) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/v1/sheets/${id}/cells`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [{ rowIndex, columnId, value }],
          }),
        });
        if (!res.ok) throw new Error("Ошибка сохранения");
        setSheet((prev) => {
          if (!prev) return prev;
          const rows = [...prev.rows];
          let row = rows.find((r) => r.rowIndex === rowIndex);
          if (!row) {
            row = { rowIndex, cells: {} };
            rows.push(row);
            rows.sort((a, b) => a.rowIndex - b.rowIndex);
          }
          row.cells = { ...row.cells, [columnId]: value };
          return { ...prev, rows };
        });
      } catch {
        toast.error("Не удалось сохранить ячейку");
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  const addRow = useCallback(async () => {
    if (!id || !sheet) return;
    const maxRow = sheet.rows.length === 0 ? -1 : Math.max(...sheet.rows.map((r) => r.rowIndex));
    const newIndex = maxRow + 1;
    if (sheet.columns.length === 0) {
      toast.info("Добавьте хотя бы одну колонку");
      return;
    }
    setSaving(true);
    try {
      const updates = sheet.columns.map((col) => ({
        rowIndex: newIndex,
        columnId: col.id,
        value: null as string | null,
      }));
      const res = await fetch(`/api/v1/sheets/${id}/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error("Ошибка");
      await loadSheet();
    } catch {
      toast.error("Не удалось добавить строку");
    } finally {
      setSaving(false);
    }
  }, [id, sheet, loadSheet]);

  const addColumn = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/sheets/${id}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Колонка ${(sheet?.columns.length ?? 0) + 1}` }),
      });
      if (!res.ok) throw new Error("Ошибка");
      await loadSheet();
    } catch {
      toast.error("Не удалось добавить колонку");
    } finally {
      setSaving(false);
    }
  }, [id, sheet?.columns.length, loadSheet]);

  const renameSheet = useCallback(async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/sheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("Ошибка");
      setSheet((prev) => (prev ? { ...prev, name: editName.trim() } : prev));
      setNameEditing(false);
    } catch {
      toast.error("Не удалось переименовать");
    } finally {
      setSaving(false);
    }
  }, [id, editName]);

  const tableData: RowRecord[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => ({
      rowIndex: r.rowIndex,
      ...r.cells,
    }));
  }, [sheet]);

  const columns: ColumnDef<RowRecord>[] = useMemo(() => {
    if (!sheet) return [];
    const cols: ColumnDef<RowRecord>[] = sheet.columns.map((col) => ({
      id: col.id,
      header: col.name,
      accessorKey: col.id,
      cell: ({ row, getValue, table }) => {
        const value = getValue() as string | null | undefined;
        const v = value ?? "";
        return (
          <Input
            className="h-8 min-w-[120px] border-0 bg-transparent text-sm focus-visible:ring-1"
            defaultValue={v}
            onBlur={(e) => {
              const next = e.target.value.trim() || null;
              if (next !== (value ?? null)) {
                table.options.meta?.updateCell?.(row.original.rowIndex, col.id, next);
              }
            }}
          />
        );
      },
    }));
    return cols;
  }, [sheet]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateCell: saveCell,
      sheetId: id,
    },
  });

  const handleExportJson = useCallback(() => {
    if (!id) return;
    window.open(`/api/v1/sheets/${id}/export?format=json`, "_blank");
  }, [id]);

  if (!id) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/sheets"
          className="inline-flex items-center gap-2 rounded-xl text-sm font-medium hover:bg-surface hover:text-foreground px-3 py-2"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку таблиц
        </Link>
        <p className="text-muted-foreground">Неверный идентификатор таблицы.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/sheets"
          className="inline-flex items-center gap-2 rounded-xl text-sm font-medium hover:bg-surface hover:text-foreground px-3 py-2"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку таблиц
        </Link>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (loading || !sheet) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/sheets"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-medium hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {nameEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameSheet()}
              className="h-8 w-48"
            />
            <Button size="sm" onClick={renameSheet} disabled={saving}>
              OK
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNameEditing(false)}>
              Отмена
            </Button>
          </div>
        ) : (
          <h1 className="text-xl font-semibold" onDoubleClick={() => setNameEditing(true)}>
            {sheet.name}
          </h1>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1">
            <Download className="h-4 w-4" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={addColumn} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            Колонка
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            Строка
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="border border-border bg-muted/50 px-2 py-1.5 text-left text-sm font-medium"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="border border-border px-2 py-4 text-center text-muted-foreground text-sm">
                    Нет данных. Нажмите «Строка» чтобы добавить строку.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border border-border p-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
