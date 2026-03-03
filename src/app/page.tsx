import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">qoqon.ru</h1>
      <p className="text-muted-foreground text-center">
        Облачное хранилище с AI-поиском по документам
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Вход
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border px-4 py-2"
        >
          Личный кабинет
        </Link>
      </div>
    </main>
  );
}
