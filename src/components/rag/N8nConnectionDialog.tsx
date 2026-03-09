"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Database,
  Loader2,
  Copy,
  Check,
  Trash2,
  Plus,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface N8nConnection {
  id: string;
  dbRoleName: string;
  viewName: string;
  target?: "DEFAULT" | "RF";
  createdAt: string;
}

type N8nTarget = "DEFAULT" | "RF";

interface N8nConnectionDialogProps {
  collectionId: string;
  collectionName: string;
  hasEmbeddings: boolean;
  onClose: () => void;
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <code className="flex-1 truncate rounded-lg border border-border bg-surface2/50 px-3 py-2 text-sm font-mono">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={onCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Копировать
        </Button>
      </div>
    </div>
  );
}

export function N8nConnectionDialog({
  collectionId,
  collectionName,
  hasEmbeddings,
  onClose,
}: N8nConnectionDialogProps) {
  const [connections, setConnections] = useState<N8nConnection[]>([]);
  const [targetsStatus, setTargetsStatus] = useState<Record<N8nTarget, boolean>>({
    DEFAULT: false,
    RF: false,
  });
  const [selectedTarget, setSelectedTarget] = useState<N8nTarget>("DEFAULT");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{
    target: N8nTarget;
    host: string;
    port: number;
    database: string;
    dbRoleName: string;
    dbPassword: string;
    viewName: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const targetLabel: Record<N8nTarget, string> = {
    DEFAULT: "Стандартный сервер",
    RF: "Внешний РФ сервер 🇷🇺",
  };

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/rag/collections/${collectionId}/n8n-connections`,
        { credentials: "include" }
      );
      const data = await res.json();
      setConnections(data.connections ?? []);
      const status: Record<N8nTarget, boolean> = {
        DEFAULT: Boolean(data?.targets?.DEFAULT),
        RF: Boolean(data?.targets?.RF),
      };
      setTargetsStatus(status);
      if (!status[selectedTarget] && status.DEFAULT) {
        setSelectedTarget("DEFAULT");
      }
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [collectionId]);

  const handleCreate = async () => {
    if (!hasEmbeddings) {
      toast.error("Сначала векторизуйте коллекцию");
      return;
    }
    setCreating(true);
    setCreatedCreds(null);
    try {
      const res = await fetch(
        `/api/v1/rag/collections/${collectionId}/n8n-connections`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: selectedTarget }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка создания подключения");
        return;
      }
      setCreatedCreds({
        target: (data.target === "RF" ? "RF" : "DEFAULT") as N8nTarget,
        host: data.host ?? "",
        port: data.port ?? 5432,
        database: data.database ?? "",
        dbRoleName: data.dbRoleName ?? "",
        dbPassword: data.dbPassword ?? "",
        viewName: data.viewName ?? "",
      });
      loadConnections();
      toast.success("Подключение создано. Сохраните данные.");
    } catch {
      toast.error("Ошибка создания подключения");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (connId: string) => {
    if (!confirm("Отозвать подключение? n8n больше не сможет использовать эту коллекцию.")) return;
    setRevokingId(connId);
    try {
      const res = await fetch(
        `/api/v1/rag/collections/${collectionId}/n8n-connections/${connId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка отзыва");
        return;
      }
      setCreatedCreds(null);
      loadConnections();
      toast.success("Подключение отозвано");
    } catch {
      toast.error("Ошибка отзыва");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success("Скопировано");
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-md min-w-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Загрузка подключения для n8n</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-lg min-w-0 overflow-hidden p-0 max-h-[90vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        <div className="border-b border-border bg-surface2/50 px-6 py-4">
          <DialogHeader>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-left">Подключение для n8n</DialogTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">{collectionName}</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {!targetsStatus.DEFAULT && !targetsStatus.RF ? (
            <p className="text-sm text-muted-foreground">
              Подключение к PostgreSQL для n8n не настроено на сервере.
            </p>
          ) : !hasEmbeddings ? (
            <p className="text-sm text-muted-foreground">
              В коллекции нет эмбеддингов. Сначала векторизуйте файлы.
            </p>
          ) : (
            <>
              <AnimatePresence mode="wait">
                {createdCreds ? (
                  <motion.div
                    key="creds"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Сохраните данные — пароль больше не будет показан
                      </p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Цель: {targetLabel[createdCreds.target]}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <CopyField
                        label="Host"
                        value={createdCreds.host}
                        copied={copiedField === "host"}
                        onCopy={() => copyToClipboard(createdCreds.host, "host")}
                      />
                      <CopyField
                        label="Port"
                        value={String(createdCreds.port)}
                        copied={copiedField === "port"}
                        onCopy={() => copyToClipboard(String(createdCreds.port), "port")}
                      />
                      <CopyField
                        label="Database"
                        value={createdCreds.database}
                        copied={copiedField === "database"}
                        onCopy={() => copyToClipboard(createdCreds.database, "database")}
                      />
                      <CopyField
                        label="User"
                        value={createdCreds.dbRoleName}
                        copied={copiedField === "user"}
                        onCopy={() => copyToClipboard(createdCreds.dbRoleName, "user")}
                      />
                      <CopyField
                        label="Password"
                        value={createdCreds.dbPassword}
                        copied={copiedField === "password"}
                        onCopy={() => copyToClipboard(createdCreds.dbPassword, "password")}
                      />
                      <CopyField
                        label="Table Name"
                        value={createdCreds.viewName}
                        copied={copiedField === "table"}
                        onCopy={() => copyToClipboard(createdCreds.viewName, "table")}
                      />
                    </div>
                    <p className="flex items-start gap-2 rounded-lg bg-surface2/50 p-2.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      n8n PGVector Store: ID=id, Vector=vector, Content=content, Metadata=metadata.
                    </p>
                    <Button variant="outline" onClick={() => setCreatedCreds(null)}>
                      Закрыть
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Куда создавать подключение</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant={selectedTarget === "DEFAULT" ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setSelectedTarget("DEFAULT")}
                        >
                          Стандартный сервер
                        </Button>
                        <Button
                          type="button"
                          variant={selectedTarget === "RF" ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setSelectedTarget("RF")}
                        >
                          Внешний РФ сервер 🇷🇺
                        </Button>
                      </div>
                      {!targetsStatus[selectedTarget] && (
                        <p className="text-xs text-destructive">
                          Для выбранного варианта не настроен URL подключения на сервере.
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleCreate}
                      disabled={creating || !targetsStatus[selectedTarget]}
                      className="w-full gap-2"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Создание...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Создать подключение
                        </>
                      )}
                    </Button>

                    {connections.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Ваши подключения</h4>
                        <div className="space-y-2">
                          {connections.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between rounded-lg border border-border bg-surface2/30 px-4 py-3"
                            >
                              <div>
                                <p className="font-mono text-sm">{c.dbRoleName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Таблица: {c.viewName} · {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Цель: {targetLabel[(c.target === "RF" ? "RF" : "DEFAULT") as N8nTarget]}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                disabled={revokingId === c.id}
                                onClick={() => handleRevoke(c.id)}
                              >
                                {revokingId === c.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="flex items-start gap-2 rounded-lg bg-surface2/50 p-2.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <a href="/dashboard/n8n-guide" className="text-primary hover:underline">
                        Инструкция по настройке n8n
                      </a>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
