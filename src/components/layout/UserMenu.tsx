"use client";

import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  initial: string;
  email: string | null | undefined;
  isAdmin: boolean;
}

export function UserMenu({ initial, email, isAdmin }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-surface2 px-3 py-2",
            "transition-colors hover:bg-surface2/80 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-background"
          )}
          aria-label="Меню пользователя"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {initial}
          </div>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium text-foreground">{email}</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Админка
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Уведомления
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/api/auth/signout" className="flex items-center gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Выйти
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
