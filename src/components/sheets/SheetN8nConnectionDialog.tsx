"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SheetN8nConnection {
  id: string;
  dbRoleName: string;
  tableName: string;
  createdAt: string;
}

interface SheetN8nConnectionDialogProps {
  sheetId: string;
  sheetName: string;
  open: boolean;
  onClose: () => void;
  onSyncDone?: () => void;
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

export function SheetN8nConnectionDialog({
  sheetId,
  sheetName,
  open,
  onClose,
  onSyncDone,
}: SheetN8nConnectionDialogProps) {
  const [connections, setConnections] = useState<SheetN8nConnection[]>([]);
  const [n8nDbEnabled, setN8nDbEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{
    host: string;
    port: number;
    database: string;
    dbRoleName: string;
    dbPassword: string;
    tableName: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadConnections = async () => {
    if (!open || !sheetId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sheets/${sheetId}/n8n-connections`, { credentials: "include" });
      const data = await res.json();
      setConnections(data.connections ?? []);
      setN8nDbEnabled(Boolean(data.n8nDbEnabled));
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadConnections();
      setCreatedCreds(null);
    }
  }, [open, sheetId]);

  const handleCreate = async () => {
    setCreating(true);
    setCreatedCreds(null);
    try {
      const res = await fetch(`/api/v1/sheets/${sheetId}/n8n-connections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка создания подключения");
        return;
      }
      setCreatedCreds({
        host: data.host ?? "",
        port: data.port ?? 5432,
        database: data.database ?? "",
        dbRoleName: data.dbRoleName ?? "",
        dbPassword: data.dbPassword ?? "",
        tableName: data.tableName ?? "",
      });
      loadConnections();
      toast.success("Подключение создано. Сохраните данные ниже.");
    } catch {
      toast.error("Ошибка создания подключения");
    } finally {
      setCreating(false);
    }
  };

  const handleSync = async (connId: string) => {
    setSyncingId(connId);
    try {
      const res = await fetch(`/api/v1/sheets/${sheetId}/n8n-connections/${connId}/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Ошибка");
      toast.success("Синхронизировано");
      onSyncDone?.();
    } catch {
      toast.error("Ошибка синхронизации");
    } finally {
      setSyncingId(null);
    }
  };

  const handleRevoke = async (connId: string) => {
    if (!confirm("Удалить подключение? n8n больше не сможет обращаться к этой таблице.")) return;
    setRevokingId(connId);
    try {
      await fetch(`/api/v1/sheets/${sheetId}/n8n-connections/${connId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setCreatedCreds(null);
      loadConnections();
      toast.success("Подключение удалено");
    } catch {
      toast.error("Ошибка удаления");
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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
                <DialogTitle className="text-left">Подключение к n8n (PostgreSQL)</DialogTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">{sheetName}</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !n8nDbEnabled ? (
            <p className="text-sm text-muted-foreground">
              Подключение к PostgreSQL для n8n не настроено на сервере.
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
                        value={createdCreds.tableName}
                        copied={copiedField === "table"}
                        onCopy={() => copyToClipboard(createdCreds.tableName, "table")}
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                      <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        Как настроить в n8n
                      </p>
                      <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                        <li>В ноде PostgreSQL укажите Host, Port, Database, User и Password из полей выше.</li>
                        <li>Schema = <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">n8n</code></li>
                        <li>Table = значение из поля «Table Name».</li>
                        <li>Колонки: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">row_index</code> (INTEGER), остальные — по названиям колонок таблицы (TEXT).</li>
                      </ul>
                    </div>
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
                    <Button
                      onClick={handleCreate}
                      disabled={creating}
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
                                <p className="font-mono text-sm">{c.tableName}</p>
                                <p className="text-xs text-muted-foreground">
                                  User: {c.dbRoleName} · {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSync(c.id)}
                                  disabled={syncingId === c.id}
                                  title="Синхронизировать"
                                >
                                  {syncingId === c.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
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
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                      <Link href="/dashboard/n8n-guide#tables" className="flex items-center gap-2 text-primary hover:underline">
                        <Info className="h-4 w-4 shrink-0" />
                        Инструкция по настройке таблиц в n8n
                      </Link>
                    </div>
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
