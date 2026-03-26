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
  Users,
  Trash2,
  Loader2,
  Clock,
  Mail,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

interface GrantItem {
  id: string;
  recipientEmail: string;
  recipientUserId: string | null;
  status: string;
  allowCollections: boolean;
  allowAiFeatures: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  recipient: { id: string; email: string; name: string | null } | null;
}

interface EmailShareGrantsDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  folderId: string | null;
  targetName: string;
}

export function EmailShareGrantsDialog({
  open,
  onClose,
  fileId,
  folderId,
  targetName: _targetName,
}: EmailShareGrantsDialogProps) {
  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!fileId && !folderId) return;

    const load = async () => {
      setLoading(true);
      try {
        const targetType = fileId ? "FILE" : "FOLDER";
        const params = new URLSearchParams({ targetType });
        if (fileId) params.set("fileId", fileId);
        else params.set("folderId", folderId!);
        const res = await fetch(`/api/v1/share/grants/outgoing?${params}`);
        if (res.ok) {
          const data = await res.json();
          setGrants(data.grants ?? []);
        }
      } catch {
        toast.error("Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, fileId, folderId]);

  const revoke = async (grantId: string) => {
    setRevokingId(grantId);
    try {
      const res = await fetch(`/api/v1/share/grants/${grantId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        setGrants((prev) => prev.filter((g) => g.id !== grantId));
        toast.success("Доступ отозван");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setRevokingId(null);
    }
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

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="success" className="gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Принято
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="warning" className="gap-1 text-xs">
            <AlertCircle className="h-3 w-3" />
            Ожидает
          </Badge>
        );
      case "DECLINED":
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            <XCircle className="h-3 w-3" />
            Отклонено
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="error" className="gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Истекло
          </Badge>
        );
      case "REVOKED":
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            Отозвано
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-sky-600" />
            Доступ по email
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : grants.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Нет приглашений по email для этого объекта
          </div>
        ) : (
          <div className="space-y-3">
            {grants.map((g) => {
              const canRevoke = g.status === "PENDING" || g.status === "ACTIVE";
              const label = g.recipient?.name
                ? `${g.recipient.name} (${g.recipientEmail})`
                : g.recipientEmail;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-border/80 bg-background/80 p-4 space-y-3 shadow-[0_12px_32px_-24px_hsl(var(--foreground)/0.45)]"
                >
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-all">{label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {statusBadge(g.status)}
                        {g.expiresAt ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            до {formatDate(g.expiresAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            Без срока
                          </Badge>
                        )}
                      </div>
                      {(g.allowCollections || g.allowAiFeatures) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {g.allowCollections && "Коллекции · "}
                          {g.allowAiFeatures && "AI"}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-foreground/75">
                        Создано: {formatDate(g.createdAt)}
                        {g.acceptedAt && ` · Принято: ${formatDate(g.acceptedAt)}`}
                      </p>
                    </div>
                  </div>
                  {canRevoke && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke(g.id)}
                        disabled={revokingId === g.id}
                        className="h-7 gap-1 text-xs text-error hover:bg-error/10 hover:text-error"
                      >
                        {revokingId === g.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Отозвать
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
