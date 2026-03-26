"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnlyofficeEditor } from "@/components/onlyoffice/OnlyofficeEditor";
import { Skeleton } from "@/components/ui/skeleton";

type ConfigOk = {
  documentServerUrl: string;
  token: string;
  documentType: string;
  documentFetchBase: string;
};

export function OnlyofficeEditorClient({ fileId }: { fileId: string }) {
  const [data, setData] = useState<ConfigOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/onlyoffice/config?fileId=${encodeURIComponent(fileId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          throw new Error(typeof j.error === "string" ? j.error : "Ошибка конфигурации");
        }
        return j as ConfigOk;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Не удалось загрузить редактор");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/files"
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к файлам
        </Link>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-[560px] w-full rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && data && (
        <OnlyofficeEditor
          fileId={fileId}
          documentServerUrl={data.documentServerUrl}
          token={data.token}
          documentType={data.documentType}
          documentFetchBase={data.documentFetchBase}
        />
      )}
    </div>
  );
}
