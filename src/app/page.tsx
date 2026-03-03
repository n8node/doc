import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-sm">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-800">
              qoqon.ru
            </h1>
            <p className="mb-8 text-lg text-slate-500">
              Облачное хранилище с AI-поиском по документам
            </p>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Войти
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Личный кабинет
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
