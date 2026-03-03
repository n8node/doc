import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200/80 bg-slate-50">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
        <p className="text-center text-sm text-slate-500 md:text-left">
          © {new Date().getFullYear()} qoqon.ru — Облачное хранилище с AI
        </p>
        <nav className="flex gap-6 text-sm text-slate-500">
          <Link href="/dashboard" className="transition-colors hover:text-slate-800">
            Личный кабинет
          </Link>
          <Link href="/login" className="transition-colors hover:text-slate-800">
            Вход
          </Link>
        </nav>
      </div>
    </footer>
  );
}
