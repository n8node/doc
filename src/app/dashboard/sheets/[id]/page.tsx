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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, ArrowLeft, Plus, Download, MoreVertical, Trash2, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";

const DATA_TYPES = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Да/Нет" },
  { value: "date", label: "Дата" },
  { value: "datetime", label: "Дата и время" },
  { value: "select", label: "Список" },
];

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
    isCellInRange?: (rowIndex: number, columnId: string) => boolean;
    onCellClick?: (rowIndex: number, columnId: string, shiftKey: boolean) => void;
    deleteRow?: (rowIndex: number) => void;
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
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    endRow: number;
    startColId: string;
    endColId: string;
  } | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnDataType, setNewColumnDataType] = useState("text");
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [fillValue, setFillValue] = useState("");
  const [n8nConnections, setN8nConnections] = useState<Array<{ id: string; dbRoleName: string; tableName: string }>>([]);
  const [n8nCreating, setN8nCreating] = useState(false);
  const [n8nSyncingId, setN8nSyncingId] = useState<string | null>(null);

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

  const loadN8nConnections = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/sheets/${id}/n8n-connections`);
      if (res.ok) {
        const data = await res.json();
        setN8nConnections(data.connections ?? []);
      }
    } catch {
      setN8nConnections([]);
    }
  }, [id]);

  useEffect(() => {
    if (sheet) loadN8nConnections();
  }, [sheet, loadN8nConnections]);

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!id) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/v1/sheets/${id}/columns/${columnId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Ошибка");
        toast.success("Колонка удалена");
        await loadSheet();
        setSelectedRange(null);
      } catch {
        toast.error("Не удалось удалить колонку");
      } finally {
        setSaving(false);
      }
    },
    [id, loadSheet]
  );

  const renameColumn = useCallback(
    async (columnId: string, name: string) => {
      if (!id || !name.trim()) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/v1/sheets/${id}/columns/${columnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) throw new Error("Ошибка");
        setSheet((prev) =>
          prev
            ? {
                ...prev,
                columns: prev.columns.map((c) => (c.id === columnId ? { ...c, name: name.trim() } : c)),
              }
            : prev
        );
        setEditingColumnId(null);
      } catch {
        toast.error("Не удалось переименовать");
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  const deleteRow = useCallback(
    async (rowIndex: number) => {
      if (!id || !sheet) return;
      const columnIds = sheet.columns.map((c) => c.id);
      if (columnIds.length === 0) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/v1/sheets/${id}/cells`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startRow: rowIndex, endRow: rowIndex, columnIds }),
        });
        if (!res.ok) throw new Error("Ошибка");
        await loadSheet();
        setSelectedRange(null);
      } catch {
        toast.error("Не удалось удалить строку");
      } finally {
        setSaving(false);
      }
    },
    [id, sheet, loadSheet]
  );

  const addColumnWithType = useCallback(async () => {
    if (!id) return;
    const name = newColumnName.trim() || `Колонка ${(sheet?.columns.length ?? 0) + 1}`;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/sheets/${id}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dataType: newColumnDataType }),
      });
      if (!res.ok) throw new Error("Ошибка");
      setAddColumnOpen(false);
      setNewColumnName("");
      setNewColumnDataType("text");
      await loadSheet();
    } catch {
      toast.error("Не удалось добавить колонку");
    } finally {
      setSaving(false);
    }
  }, [id, sheet?.columns.length, newColumnName, newColumnDataType, loadSheet]);

  const clearRange = useCallback(async () => {
    if (!id || !sheet || !selectedRange) return;
    const startIdx = sheet.columns.findIndex((c) => c.id === selectedRange.startColId);
    const endIdx = sheet.columns.findIndex((c) => c.id === selectedRange.endColId);
    const columnIds = sheet.columns.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1).map((c) => c.id);
    if (columnIds.length === 0) return;
    setSaving(true);
    try {
      await fetch(`/api/v1/sheets/${id}/cells`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startRow: Math.min(selectedRange.startRow, selectedRange.endRow),
          endRow: Math.max(selectedRange.startRow, selectedRange.endRow),
          columnIds,
        }),
      });
      await loadSheet();
      setSelectedRange(null);
    } catch {
      toast.error("Не удалось очистить");
    } finally {
      setSaving(false);
    }
  }, [id, sheet, selectedRange, loadSheet]);

  const fillRange = useCallback(async () => {
    if (!id || !sheet || !selectedRange) return;
    const colIds = sheet.columns
      .slice(
        Math.min(
          sheet.columns.findIndex((c) => c.id === selectedRange.startColId),
          sheet.columns.findIndex((c) => c.id === selectedRange.endColId)
        ),
        Math.max(
          sheet.columns.findIndex((c) => c.id === selectedRange.startColId),
          sheet.columns.findIndex((c) => c.id === selectedRange.endColId)
        ) + 1
      )
      .map((c) => c.id);
    setSaving(true);
    try {
      await fetch(`/api/v1/sheets/${id}/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fill: {
            startRow: Math.min(selectedRange.startRow, selectedRange.endRow),
            endRow: Math.max(selectedRange.startRow, selectedRange.endRow),
            columnIds: colIds,
            value: fillValue.trim() || null,
          },
        }),
      });
      setFillDialogOpen(false);
      setFillValue("");
      await loadSheet();
      setSelectedRange(null);
    } catch {
      toast.error("Не удалось заполнить");
    } finally {
      setSaving(false);
    }
  }, [id, sheet, selectedRange, fillValue, loadSheet]);

  const handleN8nCreate = useCallback(async () => {
    if (!id) return;
    setN8nCreating(true);
    try {
      const res = await fetch(`/api/v1/sheets/${id}/n8n-connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Ошибка");
      }
      const data = await res.json();
      toast.success(`Подключение создано. Пароль: ${data.dbPassword}`);
      await loadN8nConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setN8nCreating(false);
    }
  }, [id, loadN8nConnections]);

  const handleN8nSync = useCallback(
    async (connId: string) => {
      if (!id) return;
      setN8nSyncingId(connId);
      try {
        const res = await fetch(`/api/v1/sheets/${id}/n8n-connections/${connId}/sync`, { method: "POST" });
        if (!res.ok) throw new Error("Ошибка");
        toast.success("Синхронизировано");
        await loadSheet();
      } catch {
        toast.error("Ошибка синхронизации");
      } finally {
        setN8nSyncingId(null);
      }
    },
    [id, loadSheet]
  );

  const handleN8nDelete = useCallback(
    async (connId: string) => {
      if (!id || !confirm("Удалить подключение n8n?")) return;
      try {
        await fetch(`/api/v1/sheets/${id}/n8n-connections/${connId}`, { method: "DELETE" });
        await loadN8nConnections();
      } catch {
        toast.error("Ошибка удаления");
      }
    },
    [id, loadN8nConnections]
  );

  const isCellInRange = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!selectedRange || !sheet) return false;
      const colOrder = sheet.columns.map((c) => c.id);
      const c1 = colOrder.indexOf(selectedRange.startColId);
      const c2 = colOrder.indexOf(selectedRange.endColId);
      const c = colOrder.indexOf(columnId);
      if (c < 0) return false;
      const rMin = Math.min(selectedRange.startRow, selectedRange.endRow);
      const rMax = Math.max(selectedRange.startRow, selectedRange.endRow);
      return rowIndex >= rMin && rowIndex <= rMax && c >= Math.min(c1, c2) && c <= Math.max(c1, c2);
    },
    [selectedRange, sheet]
  );

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

  const openAddColumn = useCallback(() => {
    setNewColumnName("");
    setNewColumnDataType("text");
    setAddColumnOpen(true);
  }, []);

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
    const rowActionsCol: ColumnDef<RowRecord> = {
      id: "__row",
      header: "",
      size: 80,
      cell: ({ row, table }) => (
        <div className="flex h-8 items-center gap-1 px-1">
          <span className="text-muted-foreground text-xs w-6">{row.original.rowIndex}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => table.options.meta?.deleteRow?.(row.original.rowIndex)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    };
    const dataCols: ColumnDef<RowRecord>[] = sheet.columns.map((col) => ({
      id: col.id,
      header: () =>
        editingColumnId === col.id ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-32 text-sm"
              value={editingColumnName}
              onChange={(e) => setEditingColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameColumn(col.id, editingColumnName);
                if (e.key === "Escape") setEditingColumnId(null);
              }}
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={() => renameColumn(col.id, editingColumnName)}>
              OK
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1">
                <span>{col.name}</span>
                <MoreVertical className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  setEditingColumnId(col.id);
                  setEditingColumnName(col.name);
                }}
              >
                Переименовать
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => deleteColumn(col.id)}
              >
                Удалить колонку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      accessorKey: col.id,
      cell: ({ row, getValue, table }) => {
        const value = getValue() as string | null | undefined;
        const v = value ?? "";
        const inRange = table.options.meta?.isCellInRange?.(row.original.rowIndex, col.id);
        return (
          <div
            className={inRange ? "bg-primary/10" : ""}
            role="gridcell"
            onClick={(e) => table.options.meta?.onCellClick?.(row.original.rowIndex, col.id, e.shiftKey)}
          >
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
          </div>
        );
      },
    }));
    return [rowActionsCol, ...dataCols];
  }, [sheet, editingColumnId, editingColumnName, renameColumn, deleteColumn]);

  const handleCellClick = useCallback(
    (rowIndex: number, columnId: string, shiftKey: boolean) => {
      if (columnId === "__row") return;
      if (shiftKey && rangeAnchor) {
        setSelectedRange({
          startRow: rangeAnchor.rowIndex,
          endRow: rowIndex,
          startColId: rangeAnchor.columnId,
          endColId: columnId,
        });
      } else {
        setRangeAnchor({ rowIndex, columnId });
        setSelectedRange(null);
      }
    },
    [rangeAnchor]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateCell: saveCell,
      sheetId: id,
      isCellInRange,
      onCellClick: handleCellClick,
      deleteRow,
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
          {selectedRange && (
            <>
              <Button variant="outline" size="sm" onClick={clearRange} disabled={saving} className="gap-1">
                Очистить
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFillDialogOpen(true)} className="gap-1">
                Заполнить
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1">
            <Download className="h-4 w-4" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={openAddColumn} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            Колонка
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            Строка
          </Button>
        </div>
      </div>

      {n8nConnections.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Link2 className="h-4 w-4" />
              Подключения n8n (PostgreSQL)
            </div>
            <ul className="space-y-2">
              {n8nConnections.map((conn) => (
                <li key={conn.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{conn.tableName}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleN8nSync(conn.id)}
                      disabled={n8nSyncingId === conn.id}
                    >
                      {n8nSyncingId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Синхронизировать
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleN8nDelete(conn.id)}>
                      Удалить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleN8nCreate} disabled={n8nCreating}>
              {n8nCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Создать подключение n8n
            </Button>
          </CardContent>
        </Card>
      )}

      {n8nConnections.length === 0 && (
        <Card>
          <CardContent className="pt-4">
            <Button variant="outline" size="sm" onClick={handleN8nCreate} disabled={n8nCreating} className="gap-1">
              {n8nCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Создать подключение n8n (PostgreSQL)
            </Button>
          </CardContent>
        </Card>
      )}

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

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить колонку</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Название</label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder={`Колонка ${(sheet?.columns.length ?? 0) + 1}`}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Тип данных</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={newColumnDataType}
                onChange={(e) => setNewColumnDataType(e.target.value)}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Отмена</Button>
              </DialogClose>
              <Button onClick={addColumnWithType} disabled={saving}>
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fillDialogOpen} onOpenChange={setFillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заполнить диапазон</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder="Значение"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Отмена</Button>
              </DialogClose>
              <Button onClick={fillRange} disabled={saving}>
                Заполнить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
