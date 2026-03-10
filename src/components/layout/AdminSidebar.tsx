"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const navItems = [
  { href: "/admin/settings", label: "Настройки", icon: "⚙️" },
  { href: "/admin/settings?tab=branding", label: "Брендинг", icon: "🎨" },
  { href: "/admin/dashboard-content", label: "Контент дашборда", icon: "📋" },
  { href: "/admin/settings?tab=auth", label: "Авторизация", icon: "🔐" },
  { href: "/admin/plans", label: "Тарифы", icon: "👑" },
  { href: "/admin/payments", label: "Платежи", icon: "📋" },
  { href: "/admin/stats", label: "Статистика AI", icon: "📊" },
  { href: "/admin/storage", label: "Storage", icon: "📁" },
  { href: "/admin/settings?tab=s3", label: "S3", icon: "☁️" },
  { href: "/admin/settings?tab=yookassa", label: "ЮKassa", icon: "💳" },
  { href: "/admin/settings?tab=ai", label: "AI-провайдеры", icon: "🤖" },
  { href: "/admin/settings?tab=telegram", label: "Telegram", icon: "📱" },
  { href: "/admin/users", label: "Пользователи", icon: "👥" },
  { href: "/admin/invites", label: "Инвайты", icon: "🧩" },
  { href: "/admin/spam-alerts", label: "Антиспам", icon: "🚨" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const isActive = (href: string) => {
    if (pathname === "/admin/users" && href === "/admin/users") return true;
    if (pathname === "/admin/invites" && href === "/admin/invites") return true;
    if (pathname === "/admin/spam-alerts" && href === "/admin/spam-alerts") return true;
    if (pathname === "/admin/dashboard-content" && href === "/admin/dashboard-content") return true;
    if (pathname === "/admin/storage" && href === "/admin/storage") return true;
    if (pathname === "/admin/plans" && href === "/admin/plans") return true;
    if (pathname === "/admin/payments" && href === "/admin/payments") return true;
    if (pathname === "/admin/stats" && href === "/admin/stats") return true;
    if (pathname === "/admin/settings") {
      if (href === "/admin/settings" && !tab) return true;
      if (tab && href.includes(`tab=${tab}`)) return true;
    }
    return false;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 rounded-r-xl border-r border-slate-200/80 bg-slate-50 shadow-sm">
      <div className="flex h-full flex-col p-4">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-3 py-2">
          <span className="text-xl font-bold text-slate-800">Админка</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-text hover:bg-slate-200/60"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text transition-colors hover:bg-slate-200/60"
        >
          <span className="text-lg">←</span>
          В кабинет
        </Link>
      </div>
    </aside>
  );
}
