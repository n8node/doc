import Link from "next/link";
import { getSiteName } from "@/lib/branding";

export async function Footer() {
  const siteName = await getSiteName();

  return (
    <footer className="w-full border-t border-border bg-surface2">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
        <p className="text-center text-sm text-muted-foreground md:text-left">
          © {new Date().getFullYear()} {siteName} — Облачное хранилище с AI
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground"
          >
            Личный кабинет
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Вход
          </Link>
        </nav>
      </div>
    </footer>
  );
}
