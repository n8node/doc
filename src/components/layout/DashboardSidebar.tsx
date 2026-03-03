"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard/files", label: "Файлы", icon: "📁" },
  { href: "/dashboard/search", label: "Поиск", icon: "🔍" },
  { href: "/dashboard/settings", label: "Настройки", icon: "⚙️" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 rounded-r-xl border-r border-slate-200/80 bg-slate-50 shadow-sm">
      <div className="flex h-full flex-col p-4">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 py-2">
          <span className="text-xl font-bold text-slate-800">qoqon.ru</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
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
          href="/api/auth/signout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text transition-colors hover:bg-slate-200/60"
        >
          <span className="text-lg">🚪</span>
          Выйти
        </Link>
      </div>
    </aside>
  );
}
