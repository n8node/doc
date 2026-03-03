import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">qoqon.ru</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Личный кабинет
          </Link>
          {session?.user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Админка
            </Link>
          )}
          {session ? (
            <Link
              href="/api/auth/signout"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Выйти
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Вход
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
