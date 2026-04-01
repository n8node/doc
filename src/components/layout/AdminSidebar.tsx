"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Users,
  ShieldAlert,
  LifeBuoy,
  Crown,
  CreditCard,
  Wallet,
  BarChart3,
  Brain,
  LineChart,
  ImageIcon,
  Bot,
  Home,
  Map,
  ClipboardList,
  BookOpen,
  FileText,
  Link2,
  KeyRound,
  PanelTop,
  PanelBottom,
  Lock,
  Settings,
  Palette,
  HardDrive,
  Cloud,
  Smartphone,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

type NavGroup = { id: string; label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    id: "users",
    label: "Пользователи и поддержка",
    items: [
      { href: "/admin/users", label: "Пользователи", icon: Users },
      { href: "/admin/invites", label: "Инвайты", icon: KeyRound },
      { href: "/admin/spam-alerts", label: "Антиспам", icon: ShieldAlert },
      { href: "/admin/support", label: "Тикеты поддержки", icon: LifeBuoy },
    ],
  },
  {
    id: "billing",
    label: "Тарифы и платежи",
    items: [
      { href: "/admin/plans", label: "Тарифы", icon: Crown },
      { href: "/admin/payments", label: "Платежи", icon: CreditCard },
      { href: "/admin/finance", label: "Финансы", icon: Wallet },
      { href: "/admin/marketplace-stats", label: "Статистика маркетплейса", icon: BarChart3 },
    ],
  },
  {
    id: "ai",
    label: "AI и генерация",
    items: [
      { href: "/admin/stats", label: "Статистика AI", icon: Brain },
      { href: "/admin/openrouter-account", label: "OpenRouter аккаунт", icon: LineChart },
      { href: "/admin/generation", label: "Генерация изображений", icon: ImageIcon },
      { href: "/admin/settings?tab=ai", label: "AI-провайдеры", icon: Bot },
    ],
  },
  {
    id: "content",
    label: "Контент сайта",
    items: [
      { href: "/admin/landing-content", label: "Контент лендинга", icon: Home },
      { href: "/admin/roadmap", label: "Дорожная карта", icon: Map },
      { href: "/admin/dashboard-content", label: "Контент дашборда", icon: ClipboardList },
      { href: "/admin/docs", label: "Документация", icon: BookOpen },
      { href: "/admin/pages", label: "Публичные страницы", icon: FileText },
      { href: "/admin/n8n-guide", label: "Инструкция n8n", icon: Link2 },
      { href: "/admin/settings?tab=header", label: "Шапка", icon: PanelTop },
      { href: "/admin/settings?tab=footer", label: "Футер", icon: PanelBottom },
    ],
  },
  {
    id: "system",
    label: "Система и интеграции",
    items: [
      { href: "/admin/settings", label: "Общие настройки", icon: Settings },
      { href: "/admin/settings?tab=branding", label: "Брендинг", icon: Palette },
      { href: "/admin/settings?tab=auth", label: "Авторизация", icon: Lock },
      { href: "/admin/storage", label: "Storage", icon: HardDrive },
      { href: "/admin/settings?tab=s3", label: "S3", icon: Cloud },
      { href: "/admin/settings?tab=payments", label: "Платежи", icon: CreditCard },
      { href: "/admin/settings?tab=telegram", label: "Telegram", icon: Smartphone },
      { href: "/admin/telegram-broadcast", label: "Telegram-рассылка", icon: Megaphone },
    ],
  },
];

function isItemActive(
  pathname: string,
  tab: string | null,
  href: string
): boolean {
  if (href.startsWith("/admin/settings")) {
    const itemTab = href.includes("tab=") ? href.split("tab=")[1]?.split("&")[0] : null;
    if (pathname !== "/admin/settings") return false;
    if (href === "/admin/settings") return !tab;
    return itemTab === tab;
  }
  const base = href.split("?")[0];
  if (pathname === "/admin/users" && base === "/admin/users") return true;
  if (pathname === "/admin/invites" && base === "/admin/invites") return true;
  if (pathname === "/admin/spam-alerts" && base === "/admin/spam-alerts") return true;
  if (pathname.startsWith("/admin/support") && base === "/admin/support") return true;
  if (pathname === "/admin/landing-content" && base === "/admin/landing-content") return true;
  if (pathname === "/admin/roadmap" && base === "/admin/roadmap") return true;
  if (pathname === "/admin/dashboard-content" && base === "/admin/dashboard-content") return true;
  if (pathname.startsWith("/admin/docs") && base === "/admin/docs") return true;
  if (pathname.startsWith("/admin/pages") && base === "/admin/pages") return true;
  if (pathname.startsWith("/admin/n8n-guide") && base === "/admin/n8n-guide") return true;
  if (pathname === "/admin/storage" && base === "/admin/storage") return true;
  if (pathname === "/admin/plans" && base === "/admin/plans") return true;
  if (pathname === "/admin/payments" && base === "/admin/payments") return true;
  if (pathname === "/admin/stats" && base === "/admin/stats") return true;
  if (pathname === "/admin/openrouter-account" && base === "/admin/openrouter-account")
    return true;
  if (pathname === "/admin/generation" && base === "/admin/generation") return true;
  if (pathname === "/admin/marketplace-stats" && base === "/admin/marketplace-stats")
    return true;
  if (pathname === "/admin/finance" && base === "/admin/finance") return true;
  if (pathname === "/admin/telegram-broadcast" && base === "/admin/telegram-broadcast")
    return true;
  return false;
}

function findActiveGroupId(pathname: string, tab: string | null): string | null {
  for (const g of groups) {
    for (const item of g.items) {
      if (isItemActive(pathname, tab, item.href)) return g.id;
    }
  }
  return null;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const activeGroupId = useMemo(
    () => findActiveGroupId(pathname, tab),
    [pathname, tab]
  );

  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeGroupId) {
      setOpen((prev) => ({ ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  const toggle = (id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isOpen = (id: string) => open[id] ?? false;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col rounded-r-xl border-r border-slate-200/80 bg-slate-50 shadow-sm">
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <Link href="/admin" className="mb-3 shrink-0 px-2 py-2">
          <span className="text-lg font-bold text-slate-800">Админка</span>
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {groups.map((group) => {
            const expanded = isOpen(group.id);
            const hasActive = group.items.some((item) =>
              isItemActive(pathname, tab, item.href)
            );
            return (
              <div key={group.id} className="rounded-lg border border-slate-200/80 bg-white/80">
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600",
                    hasActive && "text-primary"
                  )}
                >
                  <span className="leading-tight">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                </button>
                {expanded && (
                  <div className="border-t border-slate-100 pb-1 pt-0.5">
                    {group.items.map((item) => {
                      const active = isItemActive(pathname, tab, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-90" />
                          <span className="leading-snug">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <Link
          href="/dashboard"
          className="mt-2 shrink-0 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/60"
        >
          <span aria-hidden>←</span>
          В кабинет
        </Link>
      </div>
    </aside>
  );
}
