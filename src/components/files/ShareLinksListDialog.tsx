"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  Trash2,
  Loader2,
  Copy,
  Clock,
  Shield,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ShareLinkItem {
  id: string;
  token: string;
  targetType: string;
  expiresAt: string | null;
  oneTime: boolean;
  usedAt: string | null;
  createdAt: string;
}

interface ShareLinksListDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  folderId: string | null;
  targetName: string;
  isAdmin?: boolean;
}

export function ShareLinksListDialog({
  open,
  onClose,
  fileId,
  folderId,
  targetName: _targetName,
  isAdmin = false,
}: ShareLinksListDialogProps) {
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!fileId && !folderId) return;

    const load = async () => {
      setLoading(true);
      try {
        let endpoint: string;
        if (isAdmin && fileId) {
          endpoint = `/api/v1/admin/storage/share-links?fileId=${encodeURIComponent(fileId)}`;
        } else if (!isAdmin) {
          const param = fileId
            ? `fileId=${encodeURIComponent(fileId)}`
            : `folderId=${encodeURIComponent(folderId!)}`;
          endpoint = `/api/v1/share?${param}`;
        } else {
          setLinks([]);
          setLoading(false);
          return;
        }
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setLinks(data.links ?? []);
        }
      } catch {
        toast.error("Ошибка загрузки ссылок");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, fileId, folderId, isAdmin]);

  const handleDelete = async (linkId: string) => {
    setDeletingId(linkId);
    try {
      const endpoint = isAdmin
        ? `/api/v1/admin/storage/share-links/${linkId}`
        : `/api/v1/share/${linkId}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        toast.success("Ссылка удалена");
      } else {
        toast.error("Ошибка удаления ссылки");
      }
    } catch {
      toast.error("Ошибка удаления ссылки");
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = (token: string) => {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/s/${token}`);
    toast.success("Ссылка скопирована");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isUsed = (link: ShareLinkItem) => link.oneTime && link.usedAt;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 shrink-0 text-primary" />
            Публичные ссылки
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Нет активных публичных ссылок
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const expired = isExpired(link.expiresAt);
              const used = isUsed(link);
              const inactive = expired || used;

              return (
                <div
                  key={link.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-all ${
                    inactive
                      ? "border-border/60 bg-muted/20 opacity-75"
                      : "border-border/80 bg-background/80 shadow-[0_12px_32px_-24px_hsl(var(--foreground)/0.45)]"
                  }`}
                >
                  {/* URL + Copy */}
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-2">
                    <code className="flex-1 truncate rounded-md border border-border/70 bg-foreground/[0.08] px-2.5 py-1.5 text-[12px] font-mono text-foreground">
                      /s/{link.token}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(link.token)}
                      className="h-8 w-8 p-0 shrink-0 bg-background/80 hover:bg-background"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-2.5">
                    {/* Properties */}
                    <div className="flex flex-wrap gap-2">
                      {/* Status */}
                      {expired ? (
                        <Badge variant="error" className="gap-1 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          Истекла
                        </Badge>
                      ) : used ? (
                        <Badge variant="warning" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Использована
                        </Badge>
                      ) : (
                        <Badge variant="success" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Активна
                        </Badge>
                      )}

                      {/* Expiry */}
                      {link.expiresAt ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          до {formatDate(link.expiresAt)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          Бессрочно
                        </Badge>
                      )}

                      {/* One-time */}
                      {link.oneTime && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Shield className="h-3 w-3" />
                          Одноразовая
                        </Badge>
                      )}
                    </div>

                    {/* Footer: created date + delete */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground/75">
                        Создана: {formatDate(link.createdAt)}
                        {link.usedAt && ` • Использована: ${formatDate(link.usedAt)}`}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(link.id)}
                        disabled={deletingId === link.id}
                        className="h-7 gap-1 text-xs text-error hover:bg-error/10 hover:text-error"
                      >
                        {deletingId === link.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
