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
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-xl font-semibold">Вход</h1>
        {error && (
          <p className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</p>
        )}
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary py-2 text-primary-foreground"
        >
          Войти
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-primary underline">
            Регистрация
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Загрузка...</main>}>
      <LoginForm />
    </Suspense>
  );
}
