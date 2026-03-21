"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import type { Session } from "next-auth";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderNavProps {
  session: Session | null;
}

const navLinkClass =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

export function HeaderNav({ session }: HeaderNavProps) {
  const [open, setOpen] = useState(false);

  const navLinks = (
    <>
      <Link href="/#features" className={navLinkClass}>
        Возможности
      </Link>
      <Link href="/#how-it-works" className={navLinkClass}>
        Как это работает
      </Link>
      <Link href="/docs" className={navLinkClass}>
        Документация
      </Link>
      <Link href="/roadmap" className={navLinkClass}>
        Дорожная карта
      </Link>
      <Link href="/dashboard" className={navLinkClass}>
        Личный кабинет
      </Link>
      {session?.user?.role === "ADMIN" && (
        <Link href="/admin" className={navLinkClass}>
          Админка
        </Link>
      )}
    </>
  );

  const authButtons = session ? (
    <LogoutButton>
      <Button variant="ghost" size="sm">
        Выйти
      </Button>
    </LogoutButton>
  ) : (
    <>
      <Link href="/login">
        <Button variant="outline" size="sm">
          Войти
        </Button>
      </Link>
      <Link href="/login">
        <Button size="sm">Начать работу</Button>
      </Link>
    </>
  );

  return (
    <>
      {/* Desktop nav — скрыт на мобильных */}
      <nav className="hidden md:flex items-center gap-4">
        {navLinks}
        <ThemeToggle />
        {authButtons}
      </nav>

      {/* Mobile: гамбургер + Sheet */}
      <div className="flex md:hidden items-center gap-2">
        <ThemeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Меню">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(320px,85vw)]">
            <nav className="flex flex-col gap-1 pt-8">
              <SheetClose asChild>
                <Link
                  href="/#features"
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                >
                  Возможности
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/#how-it-works"
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                >
                  Как это работает
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/docs"
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                >
                  Документация
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/roadmap"
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                >
                  Дорожная карта
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                >
                  Личный кабинет
                </Link>
              </SheetClose>
              {session?.user?.role === "ADMIN" && (
                <SheetClose asChild>
                  <Link
                    href="/admin"
                    className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-surface2"
                  >
                    Админка
                  </Link>
                </SheetClose>
              )}
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {session ? (
                  <LogoutButton>
                    <Button variant="outline" size="sm" className="w-full justify-center">
                      Выйти
                    </Button>
                  </LogoutButton>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Link href="/login">
                        <Button variant="outline" size="sm" className="w-full">
                          Войти
                        </Button>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/login">
                        <Button size="sm" className="w-full">
                          Начать работу
                        </Button>
                      </Link>
                    </SheetClose>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
