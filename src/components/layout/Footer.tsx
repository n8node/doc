import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
        <p className="text-center text-sm text-muted-foreground md:text-left">
          © {new Date().getFullYear()} qoqon.ru — Облачное хранилище с AI
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
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
