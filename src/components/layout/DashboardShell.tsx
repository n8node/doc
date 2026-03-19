"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarV2 } from "@/components/layout/SidebarV2";
import { sidebarV2Enabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  headerWidgets: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  headerWidgets,
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Overlay when mobile menu is open */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden
      />

      {/* Sidebar: slides in on mobile, fixed on desktop */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[291px] transition-transform duration-300 ease-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {sidebarV2Enabled ? <SidebarV2 /> : <Sidebar />}
      </div>

      {/* Content area */}
      <div className="pl-0 md:pl-[291px]">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {headerWidgets}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
