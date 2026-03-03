"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import {
  Search,
  Users,
  Shield,
  ShieldOff,
  Crown,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserPlus,
  Activity,
  HardDrive,
  Files,
  Ban,
  ArrowUpDown,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isBlocked: boolean;
  lastLoginAt: string | null;
  storageUsed: number;
  storageQuota: number;
  plan: { id: string; name: string; isFree: boolean } | null;
  filesCount: number;
  foldersCount: number;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  blockedUsers: number;
  newThisWeek: number;
  activeThisWeek: number;
  totalFiles: number;
  totalStorageUsed: number;
  totalStorageQuota: number;
  planDistribution: { planName: string; count: number }[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [roleFilter, setRoleFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
        order,
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (blockedFilter) params.set("blocked", blockedFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch {
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, search, roleFilter, blockedFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users/stats");
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleBlock = async (user: UserItem) => {
    const action = user.isBlocked ? "разблокировать" : "заблокировать";
    if (!confirm(`${user.isBlocked ? "Разблокировать" : "Заблокировать"} ${user.email}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !user.isBlocked }),
      });
      if (res.ok) {
        toast.success(`Пользователь ${user.isBlocked ? "разблокирован" : "заблокирован"}`);
        loadUsers();
        loadStats();
      } else {
        const data = await res.json();
        toast.error(data.error || `Ошибка: не удалось ${action}`);
      }
    } catch {
      toast.error("Ошибка соединения");
    }
  };

  const handleRoleToggle = async (user: UserItem) => {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    if (!confirm(`Сменить роль ${user.email} на ${newRole}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(`Роль изменена на ${newRole}`);
        loadUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка смены роли");
      }
    } catch {
      toast.error("Ошибка соединения");
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (!confirm(`УДАЛИТЬ пользователя ${user.email}? Все его файлы и данные будут удалены!`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Пользователь удалён");
        loadUsers();
        loadStats();
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка соединения");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const storagePercent = (used: number, quota: number) =>
    quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Пользователи</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление пользователями, ролями и статистика
          </p>
        </div>
        <Button variant="outline" onClick={() => { loadUsers(); loadStats(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Всего пользователей</p>
              </div>
            </div>
            {stats.planDistribution.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {stats.planDistribution.map((d) => (
                  <span key={d.planName} className="rounded-md bg-surface2 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {d.planName}: {d.count}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Activity className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeThisWeek}</p>
                <p className="text-xs text-muted-foreground">Активных за неделю</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <UserPlus className="mr-1 inline h-3 w-3" />
              +{stats.newThisWeek} новых за неделю
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                <HardDrive className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatBytes(stats.totalStorageUsed)}</p>
                <p className="text-xs text-muted-foreground">Всего занято</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              из {formatBytes(stats.totalStorageQuota)} суммарной квоты
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <Files className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalFiles}</p>
                <p className="text-xs text-muted-foreground">Всего файлов</p>
              </div>
            </div>
            {stats.blockedUsers > 0 && (
              <p className="mt-3 text-xs text-error">
                <Ban className="mr-1 inline h-3 w-3" />
                {stats.blockedUsers} заблокировано
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по email или имени..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все роли</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            value={blockedFilter}
            onChange={(e) => { setBlockedFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все статусы</option>
            <option value="false">Активные</option>
            <option value="true">Заблокированные</option>
          </select>

          <span className="text-sm text-muted-foreground">
            Найдено: {total}
          </span>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Пользователей не найдено</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Попробуйте изменить параметры поиска
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    <button onClick={() => handleSort("email")} className="flex items-center gap-1 hover:text-foreground">
                      Пользователь
                      {sort === "email" && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Роль</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Тариф</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    <button onClick={() => handleSort("storageUsed")} className="flex items-center gap-1 hover:text-foreground">
                      Хранилище
                      {sort === "storageUsed" && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Файлов</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    <button onClick={() => handleSort("createdAt")} className="flex items-center gap-1 hover:text-foreground">
                      Регистрация
                      {sort === "createdAt" && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    <button onClick={() => handleSort("lastLoginAt")} className="flex items-center gap-1 hover:text-foreground">
                      Активность
                      {sort === "lastLoginAt" && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const pct = storagePercent(user.storageUsed, user.storageQuota);
                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-border transition-colors hover:bg-surface2/20 ${user.isBlocked ? "opacity-60" : ""}`}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {user.name || user.email.split("@")[0]}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {user.isBlocked && (
                            <Badge variant="destructive" className="ml-1 text-[10px]">
                              <Ban className="mr-0.5 h-2.5 w-2.5" />
                              Заблокирован
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                          {user.role === "ADMIN" ? (
                            <><Shield className="mr-0.5 h-2.5 w-2.5" /> ADMIN</>
                          ) : (
                            "USER"
                          )}
                        </Badge>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        {user.plan ? (
                          <span className={`text-xs font-medium ${user.plan.isFree ? "text-success" : "text-secondary"}`}>
                            {user.plan.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Storage */}
                      <td className="px-4 py-3">
                        <div className="w-28">
                          <div className="mb-1 flex justify-between text-[10px]">
                            <span>{formatBytes(user.storageUsed)}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                            <div
                              className={`h-full rounded-full transition-all ${pct > 90 ? "bg-error" : pct > 70 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${Math.max(pct, user.storageUsed > 0 ? 2 : 0)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            из {formatBytes(user.storageQuota)}
                          </p>
                        </div>
                      </td>

                      {/* Files */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs">{user.filesCount}</span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</span>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedUser(user.id)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                            title="Подробнее"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRoleToggle(user)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
                            title={user.role === "ADMIN" ? "Снять админ" : "Сделать админом"}
                          >
                            {user.role === "ADMIN" ? (
                              <ShieldOff className="h-3.5 w-3.5" />
                            ) : (
                              <Crown className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleBlock(user)}
                            className={`rounded-lg p-1.5 transition-colors hover:bg-surface2 ${
                              user.isBlocked
                                ? "text-success hover:text-success"
                                : "text-muted-foreground hover:text-warning"
                            }`}
                            title={user.isBlocked ? "Разблокировать" : "Заблокировать"}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                            title="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Стр. {page} из {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detail dialog */}
      {selectedUser && (
        <UserDetailDialog
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdated={() => { loadUsers(); loadStats(); }}
        />
      )}
    </div>
  );
}
