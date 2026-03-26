"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Folder,
  FileIcon,
  Loader2,
  User,
  Check,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

type GrantRow = {
  id: string;
  status: string;
  targetType: string;
  allowCollections: boolean;
  allowAiFeatures: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  owner: { id: string; email: string; name: string | null };
  file: { id: string; name: string; mimeType: string } | null;
  folder: { id: string; name: string } | null;
};

type BrowseData = {
  grant: {
    id: string;
    targetType: string;
    allowCollections: boolean;
    allowAiFeatures: boolean;
  };
  owner: { id: string; name: string | null; email: string };
  currentFolderId: string | null;
  navUpFolderId: string | null;
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    folderId: string | null;
    hasEmbedding: boolean;
  }>;
};

export function SharedWithMePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const grantIdParam = searchParams.get("sharedGrantId");
  const browseFolderId = searchParams.get("sharedBrowseFolderId");

  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [browse, setBrowse] = useState<BrowseData | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const loadIncoming = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/share/grants/incoming");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка загрузки");
        setGrants([]);
        return;
      }
      setGrants(data.grants ?? []);
    } catch {
      toast.error("Ошибка сети");
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncoming();
  }, [loadIncoming]);

  const loadBrowse = useCallback(async () => {
    if (!grantIdParam) {
      setBrowse(null);
      return;
    }
    setBrowseLoading(true);
    try {
      const q = browseFolderId
        ? `?parentFolderId=${encodeURIComponent(browseFolderId)}`
        : "";
      const res = await fetch(`/api/v1/share/grants/${grantIdParam}/browse${q}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Нет доступа");
        setBrowse(null);
        return;
      }
      setBrowse(data as BrowseData);
    } catch {
      toast.error("Ошибка");
      setBrowse(null);
    } finally {
      setBrowseLoading(false);
    }
  }, [grantIdParam, browseFolderId]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  const setBrowseUrl = (grantId: string | null, folderId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "shared-with-me");
    if (grantId) params.set("sharedGrantId", grantId);
    else params.delete("sharedGrantId");
    if (folderId) params.set("sharedBrowseFolderId", folderId);
    else params.delete("sharedBrowseFolderId");
    router.push(`/dashboard/files?${params.toString()}`);
  };

  const accept = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/share/grants/${id}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success("Доступ принят");
      loadIncoming();
    } catch {
      toast.error("Ошибка");
    }
  };

  const decline = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/share/grants/${id}/decline`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success("Отклонено");
      loadIncoming();
    } catch {
      toast.error("Ошибка");
    }
  };

  if (loading && !grantIdParam) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (grantIdParam) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBrowseUrl(null, null)}
          >
            ← К списку
          </Button>
          {browse && browseFolderId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (browse.navUpFolderId) setBrowseUrl(grantIdParam, browse.navUpFolderId);
                else setBrowseUrl(grantIdParam, null);
              }}
            >
              ↑ Вверх
            </Button>
          )}
          {browse && (
            <span className="text-sm text-muted-foreground">
              от {browse.owner.name || browse.owner.email}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto gap-1"
            onClick={() => loadBrowse()}
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        </div>

        {browseLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!browseLoading && browse && (
          <div className="space-y-2">
            {browse.folders.map((fo) => (
              <button
                key={fo.id}
                type="button"
                onClick={() => setBrowseUrl(grantIdParam, fo.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition hover:bg-surface2/50"
              >
                <Folder className="h-5 w-5 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate font-medium">{fo.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
            {browse.files.map((fi) => (
              <button
                key={fi.id}
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/v1/files/${fi.id}/download`);
                    const d = await res.json();
                    if (res.ok && d.url) window.open(d.url, "_blank", "noopener,noreferrer");
                    else toast.error(d.error || "Не удалось открыть");
                  } catch {
                    toast.error("Ошибка");
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition hover:bg-surface2/50"
              >
                <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fi.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(fi.size)}
                    {fi.hasEmbedding ? " · AI" : ""}
                  </p>
                </div>
              </button>
            ))}
            {browse.grant.targetType === "FILE" &&
              browse.files.length === 1 &&
              browse.folders.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Нажмите на файл, чтобы открыть или скачать.
                </p>
              )}
            {browse.folders.length === 0 && browse.files.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Пусто</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Файлы и папки, к которым вам открыли доступ по email. Публичные ссылки — в разделе «Публичные ссылки».
      </p>

      {grants.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Нет приглашений
        </div>
      )}

      <ul className="space-y-3">
        {grants.map((g) => {
          const label =
            g.targetType === "FILE"
              ? g.file?.name ?? "Файл"
              : g.folder?.name ?? "Папка";
          return (
            <li
              key={g.id}
              className="rounded-xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      от {g.owner.name || g.owner.email}
                    </p>
                    {g.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        до {new Date(g.expiresAt).toLocaleString("ru-RU")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {g.status === "PENDING" && "Ожидает ответа"}
                      {g.status === "ACTIVE" && "Доступ активен"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {g.status === "PENDING" && (
                    <>
                      <Button size="sm" className="gap-1" onClick={() => accept(g.id)}>
                        <Check className="h-4 w-4" />
                        Принять
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => decline(g.id)}
                      >
                        <X className="h-4 w-4" />
                        Отклонить
                      </Button>
                    </>
                  )}
                  {g.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setBrowseUrl(g.id, null)}
                    >
                      Открыть
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
