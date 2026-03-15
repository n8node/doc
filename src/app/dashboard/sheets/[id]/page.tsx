"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface SheetData {
  id: string;
  name: string;
  columns: Array<{ id: string; order: number; name: string; dataType: string; config: unknown }>;
  rows: Array<{ rowIndex: number; cells: Record<string, string | null> }>;
}

export default function SheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!id) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/sheets" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            К списку таблиц
          </Link>
        </Button>
        <p className="text-muted-foreground">Неверный идентификатор таблицы.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/sheets" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            К списку таблиц
          </Link>
        </Button>
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/sheets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{sheet.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Данные</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Колонок: {sheet.columns.length}, строк: {sheet.rows.length}. Редактор с TanStack Table подключается в следующем шаге.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify({ columns: sheet.columns.length, rows: sheet.rows.length }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
