import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/LogoutButton";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/95 shadow-soft backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-xl font-bold text-foreground transition-opacity hover:opacity-80"
        >
          qoqon.ru
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Личный кабинет
          </Link>
          {session?.user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Админка
            </Link>
          )}
          <ThemeToggle />
          {session ? (
            <LogoutButton>
              <Button variant="ghost" size="sm">
                Выйти
              </Button>
            </LogoutButton>
          ) : (
            <Link href="/login">
              <Button size="sm">Вход</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
