"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <form
        onSubmit={handleSubmit}
        className="glass w-full max-w-md rounded-2xl p-8"
      >
        <h1 className="mb-6 text-2xl font-semibold text-foreground">Вход</h1>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-medium"
        >
          Войти
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Регистрация
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50">Загрузка...</main>}>
      <LoginForm />
    </Suspense>
  );
}
