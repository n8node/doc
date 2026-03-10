"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, HardDrive, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [siteName, setSiteName] = useState("qoqon.ru");

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((data) => setSiteName(data?.siteName || "qoqon.ru"))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить письмо");
        return;
      }

      setSent(true);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <HardDrive className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Восстановление пароля</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Введите email, привязанный к аккаунту {siteName}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-8 shadow-soft"
        >
          {sent ? (
            <p className="text-center text-sm text-muted-foreground">
              Если аккаунт с таким email существует, на него отправлена ссылка для восстановления
              пароля. Проверьте входящие и папку «Спам».
            </p>
          ) : (
            <>
              {error && (
                <div className="mb-5 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>Отправить ссылку</>
                )}
              </button>
            </>
          )}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Вернуться ко входу
            </Link>
          </p>
        </form>
      </motion.div>
    </main>
  );
}
