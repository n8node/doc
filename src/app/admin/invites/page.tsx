"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

type RegistrationChannel = "EMAIL" | "TELEGRAM" | "BOTH" | null;

interface InviteRow {
  id: string;
  code: string;
  scope: "SYSTEM" | "USER";
  status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";
  createdAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  ownerUser: { id: string; email: string; name: string | null } | null;
  createdByUser: { id: string; email: string; name: string | null } | null;
  usedByUser: { id: string; email: string; name: string | null; telegramUsername: string | null } | null;
  registrationChannel: RegistrationChannel;
  registrationAt: string | null;
}

interface RelationRow {
  id: string;
  inviteCode: string;
  inviter: { id: string; email: string; name: string | null } | null;
  invited: { id: string; email: string; name: string | null } | null;
  usedAt: string | null;
  registeredAt: string | null;
  registrationChannel: RegistrationChannel;
}

const CHANNEL_LABEL: Record<Exclude<RegistrationChannel, null>, string> = {
  EMAIL: "Email",
  TELEGRAM: "Telegram",
  BOTH: "Email + Telegram",
};

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [banLoadingUserId, setBanLoadingUserId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (scope) params.set("scope", scope);
      if (channel) params.set("channel", channel);

      const res = await fetch(`/api/v1/admin/invites?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки инвайтов");

      setInvites(Array.isArray(data.invites) ? data.invites : []);
      setRelations(Array.isArray(data.relations) ? data.relations : []);
      setTotalPages(Number(data.totalPages || 1));
      setTotal(Number(data.total || 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки инвайтов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, scope, channel]);

  const relationStats = useMemo(() => {
    const invitedByUser = new Map<string, number>();
    for (const item of relations) {
      if (!item.inviter?.id) continue;
      invitedByUser.set(item.inviter.id, (invitedByUser.get(item.inviter.id) || 0) + 1);
    }
    return {
      totalRelations: relations.length,
      invitersCount: invitedByUser.size,
    };
  }, [relations]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (row: InviteRow) => {
    if (row.status === "ACTIVE") return <Badge variant="success">ACTIVE</Badge>;
    if (row.status === "USED") return <Badge variant="secondary">USED</Badge>;
    if (row.status === "EXPIRED") return <Badge variant="warning">EXPIRED</Badge>;
    return <Badge variant="error">REVOKED</Badge>;
  };

  const handleBanChain = async (inviter: RelationRow["inviter"]) => {
    if (!inviter?.id) return;
    const ok = window.confirm(
      `Забанить инвайт-связку для ${inviter.email}?\n` +
        "Будут заблокированы участники цепочки и отозваны активные инвайты."
    );
    if (!ok) return;

    setBanLoadingUserId(inviter.id);
    try {
      const res = await fetch("/api/v1/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban_chain",
          rootUserId: inviter.id,
          reason: "SPAM_REGISTRATION_CHAIN",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка блокировки связки");
      toast.success(
        `Связка заблокирована: пользователей ${data.usersBlocked}, инвайтов отозвано ${data.invitesRevoked}`
      );
      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка блокировки связки"
      );
    } finally {
      setBanLoadingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Инвайты и связи</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Реестр всех ключей, статусы использования и связи между пользователями
          </p>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Всего инвайтов</p>
          <p className="mt-2 text-2xl font-bold">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Связей inviter → invited</p>
          <p className="mt-2 text-2xl font-bold">{relationStats.totalRelations}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Пользователей-источников</p>
          <p className="mt-2 text-2xl font-bold">{relationStats.invitersCount}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по коду, email, имени..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="USED">USED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="REVOKED">REVOKED</option>
          </select>

          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все scope</option>
            <option value="SYSTEM">SYSTEM</option>
            <option value="USER">USER</option>
          </select>

          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все каналы</option>
            <option value="EMAIL">Email</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="BOTH">Email + Telegram</option>
          </select>

          <Button
            onClick={() => {
              setPage(1);
              loadData();
            }}
          >
            Применить
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Код</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Статус</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Scope</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Владелец ключа</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Использовал</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Канал</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Регистрация</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Использован</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((row) => (
                    <tr key={row.id} className="border-b border-border/70">
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2">{statusBadge(row)}</td>
                      <td className="px-3 py-2">{row.scope}</td>
                      <td className="px-3 py-2">{row.ownerUser?.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.usedByUser?.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.registrationChannel ? CHANNEL_LABEL[row.registrationChannel] : "—"}</td>
                      <td className="px-3 py-2">{formatDate(row.registrationAt)}</td>
                      <td className="px-3 py-2">{formatDate(row.usedAt)}</td>
                      <td className="px-3 py-2">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Стр. {page} из {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Далее
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Связи пользователей</h2>
              <p className="text-xs text-muted-foreground">
                Кто зарегистрировался по чьему ключу
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Inviter</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invited</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Код</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Канал</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Дата регистрации</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        Пока нет связей
                      </td>
                    </tr>
                  ) : (
                    relations.map((row) => (
                      <tr key={row.id} className="border-b border-border/70">
                        <td className="px-3 py-2">{row.inviter?.email ?? "—"}</td>
                        <td className="px-3 py-2">{row.invited?.email ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.inviteCode}</td>
                        <td className="px-3 py-2">{row.registrationChannel ? CHANNEL_LABEL[row.registrationChannel] : "—"}</td>
                        <td className="px-3 py-2">{formatDate(row.registeredAt)}</td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!row.inviter?.id || banLoadingUserId === row.inviter?.id}
                            onClick={() => handleBanChain(row.inviter)}
                          >
                            {banLoadingUserId === row.inviter?.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Блок...
                              </>
                            ) : (
                              "Бан связки"
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
