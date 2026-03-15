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
import { Loader2, ArrowLeft, Plus, Download, MoreVertical, Trash2, Link2, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { SheetN8nConnectionDialog } from "@/components/sheets/SheetN8nConnectionDialog";

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
  const [n8nDialogOpen, setN8nDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<{ columnId: string; dir: "asc" | "desc" } | null>(null);
  const [filterBy, setFilterBy] = useState<{ columnId: string; type: "contains" | "equals" | "empty"; value?: string } | null>(null);
  const [filterColumnOpen, setFilterColumnOpen] = useState<string | null>(null);
  const [filterInputValue, setFilterInputValue] = useState("");
  const [filterType, setFilterType] = useState<"contains" | "equals" | "empty">("contains");
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [fillDragging, setFillDragging] = useState(false);
  const [fillDragEnd, setFillDragEnd] = useState<{ rowIndex: number; columnId: string } | null>(null);

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

  useEffect(() => {
    if (!fillDragging || !rangeAnchor || !sheet) return;
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest("[data-sheet-row][data-sheet-col]");
      if (cell) {
        const r = parseInt(cell.getAttribute("data-sheet-row") ?? "", 10);
        const c = cell.getAttribute("data-sheet-col");
        if (!Number.isNaN(r) && c) setFillDragEnd({ rowIndex: r, columnId: c });
      }
    };
    const onUp = async () => {
      setFillDragging(false);
      if (!rangeAnchor || !fillDragEnd || !id || !sheet) return;
      const colIds = sheet.columns.map((x) => x.id);
      const c1 = colIds.indexOf(rangeAnchor.columnId);
      const c2 = colIds.indexOf(fillDragEnd.columnId);
      if (c1 < 0 || c2 < 0) return;
      const startRow = Math.min(rangeAnchor.rowIndex, fillDragEnd.rowIndex);
      const endRow = Math.max(rangeAnchor.rowIndex, fillDragEnd.rowIndex);
      const startC = Math.min(c1, c2);
      const endC = Math.max(c1, c2);
      const fillColIds = colIds.slice(startC, endC + 1);
      const anchorRow = sheet.rows.find((r) => r.rowIndex === rangeAnchor.rowIndex);
      const value = anchorRow?.cells[rangeAnchor.columnId] ?? null;
      setFillDragEnd(null);
      if (startRow === endRow && fillColIds.length === 1) return;
      setSaving(true);
      try {
        await fetch(`/api/v1/sheets/${id}/cells`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fill: { startRow, endRow, columnIds: fillColIds, value } }),
        });
        await loadSheet();
        setSelectedRange(null);
        toast.success("Диапазон заполнен");
      } catch {
        toast.error("Не удалось заполнить");
      } finally {
        setSaving(false);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
    };
  }, [fillDragging, rangeAnchor, sheet, id, loadSheet]);

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

  const tableData: RowRecord[] = useMemo(() => {
    if (!sheet) return [];
    let rows: RowRecord[] = sheet.rows.map((r) => ({
      rowIndex: r.rowIndex,
      ...r.cells,
    } as RowRecord));
    if (filterBy) {
      const colId = filterBy.columnId;
      const val = filterBy.value?.toLowerCase() ?? "";
      rows = rows.filter((row) => {
        const cell = row[colId];
        const s = (cell != null ? String(cell) : "").toLowerCase();
        if (filterBy.type === "empty") return !s.trim();
        if (filterBy.type === "equals") return s.trim() === val.trim();
        return s.includes(val.trim());
      });
    }
    if (sortBy) {
      const colId = sortBy.columnId;
      const dir = sortBy.dir;
      rows = [...rows].sort((a, b) => {
        const va = a[colId] != null ? String(a[colId]) : "";
        const vb = b[colId] != null ? String(b[colId]) : "";
        const c = va.localeCompare(vb, undefined, { numeric: true });
        return dir === "asc" ? c : -c;
      });
    }
    return rows;
  }, [sheet, sortBy, filterBy]);

  const toggleRowSelection = useCallback((rowIndex: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }, []);

  const selectAllRows = useCallback(() => {
    if (!sheet) return;
    const indices = new Set(tableData.map((r) => r.rowIndex as number));
    setSelectedRowIndices(indices);
  }, [sheet, tableData]);

  const clearRowSelection = useCallback(() => setSelectedRowIndices(new Set()), []);

  const deleteSelectedRows = useCallback(async () => {
    if (!id || !sheet || selectedRowIndices.size === 0) return;
    const columnIds = sheet.columns.map((c) => c.id);
    if (columnIds.length === 0) return;
    setSaving(true);
    try {
      for (const rowIndex of Array.from(selectedRowIndices)) {
        await fetch(`/api/v1/sheets/${id}/cells`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startRow: rowIndex, endRow: rowIndex, columnIds }),
        });
      }
      await loadSheet();
      setSelectedRowIndices(new Set());
      setSelectedRange(null);
      toast.success(`Удалено строк: ${selectedRowIndices.size}`);
    } catch {
      toast.error("Не удалось удалить строки");
    } finally {
      setSaving(false);
    }
  }, [id, sheet, selectedRowIndices, loadSheet]);

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

  const columns: ColumnDef<RowRecord>[] = useMemo(() => {
    if (!sheet) return [];
    const dataTypeLabel = (dt: string) => DATA_TYPES.find((t) => t.value === dt)?.label ?? dt;

    const checkCol: ColumnDef<RowRecord> = {
      id: "__check",
      header: () => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={tableData.length > 0 && selectedRowIndices.size === tableData.length}
          onChange={(e) => (e.target.checked ? selectAllRows() : clearRowSelection())}
          title="Выбрать все"
        />
      ),
      size: 44,
      cell: ({ row }) => (
        <div className="flex h-8 items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={selectedRowIndices.has(row.original.rowIndex)}
            onChange={() => toggleRowSelection(row.original.rowIndex)}
          />
        </div>
      ),
    };

    const rowActionsCol: ColumnDef<RowRecord> = {
      id: "__row",
      header: () => <span className="text-muted-foreground text-xs">#</span>,
      size: 56,
      cell: ({ row, table }) => (
        <div className="flex h-8 items-center gap-1 px-1">
          <span className="text-muted-foreground text-xs w-5">{(row.original.rowIndex as number) + 1}</span>
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

    const dataCols: ColumnDef<RowRecord>[] = sheet.columns.map((col) => {
      return {
        id: col.id,
        header: () =>
          editingColumnId === col.id ? (
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-32 text-sm rounded-none"
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
                <button type="button" className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1 text-left w-full min-w-0">
                  <span className="font-medium truncate">{col.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0">({dataTypeLabel(col.dataType)})</span>
                  <MoreVertical className="h-3 w-3 opacity-50 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => { setSortBy((s) => (s?.columnId === col.id && s.dir === "asc" ? null : { columnId: col.id, dir: "asc" })); }}>
                  <ArrowUp className="h-3.5 w-3.5 mr-2" />
                  Сортировать по возрастанию
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy((s) => (s?.columnId === col.id && s.dir === "desc" ? null : { columnId: col.id, dir: "desc" })); }}>
                  <ArrowDown className="h-3.5 w-3.5 mr-2" />
                  Сортировать по убыванию
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setFilterColumnOpen(col.id); setFilterInputValue(filterBy?.columnId === col.id ? (filterBy.value ?? "") : ""); setFilterType(filterBy?.columnId === col.id ? filterBy.type : "contains"); }}>
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  Фильтр по колонке
                </DropdownMenuItem>
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
          const isAnchor = rangeAnchor?.rowIndex === row.original.rowIndex && rangeAnchor?.columnId === col.id;
          return (
            <div
              className={`relative ${inRange ? "bg-primary/10" : ""}`}
              role="gridcell"
              onClick={(e) => table.options.meta?.onCellClick?.(row.original.rowIndex, col.id, e.shiftKey)}
              data-sheet-row={row.original.rowIndex}
              data-sheet-col={col.id}
            >
              <Input
                className="h-8 min-w-[120px] rounded-none border-0 bg-transparent text-sm focus-visible:ring-1"
                defaultValue={v}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== (value ?? null)) {
                    table.options.meta?.updateCell?.(row.original.rowIndex, col.id, next);
                  }
                }}
              />
              {isAnchor && !selectedRange && (
                <div
                  className="absolute bottom-0 right-0 h-2 w-2 bg-primary cursor-crosshair shrink-0"
                  title="Перетащите для заполнения"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFillDragging(true);
                    setFillDragEnd({ rowIndex: row.original.rowIndex, columnId: col.id });
                  }}
                />
              )}
            </div>
          );
        },
      };
    });
    return [checkCol, rowActionsCol, ...dataCols];
  }, [sheet, editingColumnId, editingColumnName, renameColumn, deleteColumn, selectedRowIndices, tableData, rangeAnchor, selectedRange, filterBy]);

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

  const applyFilter = useCallback(() => {
    if (!filterColumnOpen) return;
    setFilterBy({
      columnId: filterColumnOpen,
      type: filterType,
      value: filterType === "empty" ? undefined : filterInputValue,
    });
    setFilterColumnOpen(null);
  }, [filterColumnOpen, filterType, filterInputValue]);

  const clearFilter = useCallback(() => {
    setFilterBy(null);
    setFilterColumnOpen(null);
  }, []);

  const isColumnHighlighted = useCallback(
    (columnId: string) => {
      if (rangeAnchor?.columnId === columnId) return true;
      if (!selectedRange || !sheet) return false;
      const order = sheet.columns.map((c) => c.id);
      const a = order.indexOf(selectedRange.startColId);
      const b = order.indexOf(selectedRange.endColId);
      const c = order.indexOf(columnId);
      return c >= Math.min(a, b) && c <= Math.max(a, b);
    },
    [rangeAnchor, selectedRange, sheet]
  );

  const isRowHighlighted = useCallback(
    (rowIndex: number) => {
      if (rangeAnchor?.rowIndex === rowIndex) return true;
      if (!selectedRange) return false;
      const minR = Math.min(selectedRange.startRow, selectedRange.endRow);
      const maxR = Math.max(selectedRange.startRow, selectedRange.endRow);
      return rowIndex >= minR && rowIndex <= maxR;
    },
    [rangeAnchor, selectedRange]
  );

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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {selectedRowIndices.size > 0 && (
            <Button variant="outline" size="sm" onClick={deleteSelectedRows} disabled={saving} className="gap-1 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
              Удалить выбранные ({selectedRowIndices.size})
            </Button>
          )}
          {(sortBy || filterBy) && (
            <Button variant="ghost" size="sm" onClick={() => { setSortBy(null); setFilterBy(null); }} className="gap-1 text-muted-foreground">
              Сбросить сортировку и фильтр
            </Button>
          )}
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
          <Button size="sm" onClick={addRow} disabled={saving} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
            <Plus className="h-4 w-4" />
            Добавить строку
          </Button>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => setN8nDialogOpen(true)} className="gap-1">
        <Link2 className="h-4 w-4" />
        Подключения n8n (PostgreSQL)
      </Button>

      <SheetN8nConnectionDialog
        sheetId={id}
        sheetName={sheet.name}
        open={n8nDialogOpen}
        onClose={() => setN8nDialogOpen(false)}
        onSyncDone={loadSheet}
      />

      <Card className="rounded-none">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h, i) => (
                  <th
                    key={`letter-${h.id}`}
                    className={`border border-border bg-muted/30 px-1 py-0.5 text-center text-xs font-medium text-muted-foreground ${(h.column.id !== "__check" && h.column.id !== "__row" && isColumnHighlighted(h.column.id)) ? "bg-primary/15" : ""}`}
                  >
                    {h.column.id === "__check" || h.column.id === "__row"
                      ? ""
                      : (() => {
                          const li = i - 2;
                          if (li < 0) return "";
                          if (li < 26) return String.fromCharCode(65 + li);
                          return String.fromCharCode(64 + Math.floor(li / 26)) + String.fromCharCode(65 + (li % 26));
                        })()}
                  </th>
                ))}
              </tr>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className={`border border-border bg-muted/50 px-2 py-1.5 text-left text-sm font-medium ${(h.column.id !== "__check" && h.column.id !== "__row" && isColumnHighlighted(h.column.id)) ? "bg-primary/15" : ""}`}
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
                    Нет данных. Нажмите «Добавить строку» чтобы добавить строку.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={isRowHighlighted((row.original as RowRecord).rowIndex) ? "bg-primary/5" : ""}
                  >
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

      <Dialog open={!!filterColumnOpen} onOpenChange={(open) => !open && setFilterColumnOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Фильтр по колонке</DialogTitle>
            {filterColumnOpen && (
              <p className="text-sm text-muted-foreground">
                {sheet?.columns.find((c) => c.id === filterColumnOpen)?.name}
              </p>
            )}
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Условие</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "contains" | "equals" | "empty")}
              >
                <option value="contains">Содержит</option>
                <option value="equals">Равно</option>
                <option value="empty">Пусто</option>
              </select>
            </div>
            {filterType !== "empty" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Значение</label>
                <Input
                  value={filterInputValue}
                  onChange={(e) => setFilterInputValue(e.target.value)}
                  placeholder="Введите значение"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={clearFilter}>
                Сбросить фильтр
              </Button>
              <Button onClick={applyFilter}>
                Применить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
